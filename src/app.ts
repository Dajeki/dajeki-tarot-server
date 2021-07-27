//import "./lib/env"; //conditional render of development or production env variables COMMENT OUT FOR DEPLOYMENT ON HEROKU

import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";

import { Pool, PoolClient, QueryResult } from "pg";
import { OAuth2Client } from "google-auth-library";

import { getRandomUniqueCardIDs } from "./utils/getRandomUniqueCardsIDs";
import { getCardsByIDQueryGen, getPastSavedSpreadsQueryGen, saveCardSpreadQueryGen, upsertUserQueryGen } from "./pqDbQueries";
import { errorGen } from "./utils/errorGen";
import { randomDirectionOrdered } from "./utils/randomizeCardDirection";

const app = express();

const optionsCors: cors.CorsOptions = {
	credentials      : true,
	methods          : "GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE",
	origin           : process.env.ACCEPTED_ORIGIN,
	preflightContinue: false,
};

app.use( cors( optionsCors ));

const optionsLimiter: rateLimit.Options = {
	windowMs: 60 * 1000, //1 Minute
	max     : 100,
	message : "{\"error\": \"Too many calls to this endpoint. You are limited to 100 per minute.\"}",
};
app.set( "trust proxy", 1 );
app.use( rateLimit( optionsLimiter ));

//save_spread enpoint is going to come as a JSON object from the front end.
app.use( "/cards/save_spread", express.json());
console.log( process.env.REACT_APP_API_URL );
const PORT = parseInt( process.env.PORT || "0" );
const { GOOGLE_CLIENT_ID, DATABASE_URL } = process.env;

/**
 * Checking to make sure that the .env variables that are required for the backend are set.
 */
if( PORT && GOOGLE_CLIENT_ID && DATABASE_URL ) {

	const client = new OAuth2Client( GOOGLE_CLIENT_ID );
	/**
	 * Middleware to verify JWT instead of placing in every request.
	 * Requires an OAuth2Client to verify.
	 * use the Request.googleTokenPayload property to check for valid token.
	 */
	app.use( async function ( req, res, next ) {
		const JWT = req.headers.authorization?.split( " " )[1];
		try {
			if( !JWT ) {
				throw errorGen( "TokenError", "No loggin credentials sent with request." );
			}
			//Error thrown here if JWT inccorect.
			const ticket = await client.verifyIdToken({
				idToken : JWT || "",
				audience: GOOGLE_CLIENT_ID,
			});
			req.googleTokenPayload = ticket.getPayload();
			console.log( `User ${ req.googleTokenPayload?.name } verified` );
		}
		catch( err ) {
			console.log(( err as Error ).message );
		}

		next();
	});

	const dbConnectionPool = new Pool({
		connectionString: DATABASE_URL,
		ssl             : {
			rejectUnauthorized: false,
		},
	});

	/**
	 * Cards db access.
	 * :amount - should be the number of random cards you would like returned.
	 * request is returned as as application/json
	 */
	app.get( "/cards/:amount", async ( req, res ) => {
		const requestAmount = parseInt( req.params.amount );
		//needs to be "defined" so I can attempt to call a free on the connection in the finally block
		let dbClient: PoolClient | undefined = undefined;

		try {
			if( isNaN( requestAmount )) {
				throw errorGen( "RequestNaN", "The requested amount is not a number." );
			}
			else if( requestAmount < 1 ) {
				throw errorGen( "RequestTooLow", "Please ask for at least 1 card." );
			}
			else if( requestAmount > 78 ) {
				throw errorGen( "RequestTooHigh", "The request card amount is higher than cards in a tarot deck." );
			}

			dbClient = await dbConnectionPool.connect();
			const queryParamsForID = getCardsByIDQueryGen( getRandomUniqueCardIDs( requestAmount ));
			const queryResults: QueryResult<CardDBResults> = await dbClient.query( queryParamsForID );

			//Put the query results for the cards back in the randomly selected order from earlier.
			const orderedCardResults = randomDirectionOrdered( queryParamsForID.values || [], queryResults.rows );
			res.json( orderedCardResults );
		}
		catch( err ) {
			res.status( 400 )
				.json({ error: ( err as Error ).message });
		}
		finally {
			dbClient?.release();
		}
	});

	/**
	 * Login endpoint
	 * Currently verifies only Google 0Auth2 JWT -  https://developers.google.com/identity/sign-in/web/backend-auth#verify-the-integrity-of-the-id-token
	 */
	app.post( "/userInfo/login", async ( req, res ) => {
		//needs to be "defined" so I can attempt to call a free on the connection in the finally block
		let dbClient: PoolClient | undefined = undefined;

		try {
			if( !req.googleTokenPayload ) {
				throw errorGen( "TokenError", "Not logged in or incorrect token sent with response." );
			}
			//Sub is UUID, given_name is either hidden or Full name
			const { sub: userId, given_name = "" } = req.googleTokenPayload;
			const [queryUpdateUser, queryInsertUser] = upsertUserQueryGen({ username: given_name, id: userId });

			//CONNECT TO DB HERE
			dbClient = await dbConnectionPool.connect();
			const updateQueryResults = await dbClient.query( queryUpdateUser );
			console.log( "Rows affected from update:", updateQueryResults.rowCount );

			if( updateQueryResults.rowCount <= 0 ) {
				const insertQueryResults = await dbClient.query( queryInsertUser );
				console.log( "Rows affected from insert:", insertQueryResults.rowCount );
			}

			res.json({ success: `Login sucessful for ${ given_name }` });
		}
		catch( err ) {
			res.status( 401 )
				.json({ error: ( err as Error ).message });
		}
		finally {
			dbClient?.release();
		}
	});

	/**
	 * Save spread endpoint that will require the user to be logged in to use.
	 * The request to this endpoint body should be sent in JSON as the body will be parsed as such.
	 */
	app.put( "/cards/save_spread", async ( req, res ) => {
		//needs to be "defined" so I can attempt to call a free on the connection in the finally block
		let dbClient: PoolClient | undefined = undefined;

		try {
			if( !req.googleTokenPayload ) {
				throw errorGen( "TokenError", "Not logged in or incorrect token sent with response." );
			}
			const { sub: userId } = req.googleTokenPayload;

			//CONNECT TO DB HERE
			dbClient = await dbConnectionPool.connect();
			//Check to make sure that a spread has not been saved today by querying the saved spread db.
			const savedAlready =  await dbClient.query({
				text  : "SELECT public.user_draws.date_drawn FROM public.user_draws WHERE public.user_draws.date_drawn = $1",
				values: [new Date().toUTCString()],
			});
			if( savedAlready.rowCount > 0 ) {
				throw errorGen( "FrequencyError", "Only one spread can be saved per day." );
			}

			const saveCardQuery = saveCardSpreadQueryGen( req.body.cards, userId, req.body.spreadId, req.body.spreadDir );
			const saveQueryResults = await dbClient.query( saveCardQuery );

			if( saveQueryResults.rowCount === 0 ) {
				//Check to make sure the body is what we expected.
				console.log( req.body.cards, userId, req.body.spreadId, req.body.spreadDir );
				throw errorGen( "DbError", "DB connected but query did not execute." );
			}

			console.log( "Saved User's Spread." );
			res.json({ success: "Saved Spread!" });
		}
		catch( err ) {
			res.status( 500 ).json({
				error    : ( err as Error ).message,
				//If this error comes from the frequency error send the date with the response
				availTime: ( err as Error ).name === "FrequencyError" ? 24 - new Date( Date.now()).getUTCHours() : null,
			});
		}
		finally {
			dbClient?.release();
		}
	});

	/**
	 * Users past spread enpoint
	 * request only requires that the JWT is sent with the response to get the last 7 user saved spreads.
	 */
	app.get( "/userInfo/past_spread", async ( req, res ) => {

		//needs to be "defined" so I can attempt to call a free on the connection in the finally block
		let dbClient: PoolClient | undefined = undefined;

		try {
			if( !req.googleTokenPayload ) {
				throw errorGen( "TokenError", "Not logged in or incorrect token sent with response." );
			}

			//Only need the sub from the JWT token
			const { sub: userId } = req.googleTokenPayload;
			const pastSpreadsQuery = getPastSavedSpreadsQueryGen( userId );

			dbClient = await dbConnectionPool.connect();
			const queryResults: QueryResult<PastSpreadsResults> = await dbClient.query( pastSpreadsQuery );

			res.json( queryResults.rows );
		}
		catch( err ) {
			res.status( 400 )
				.json({ error: ( err as Error ).message });
		}
		finally {
			dbClient?.release();
		}
	});


	app.listen( PORT, () => {
		console.log( `⚡️[server]: Server is running at http://localhost:${ PORT }` );
	});

}
else {

	let errorString = "";
	errorString += PORT ? "PORT\n" : "";
	errorString += GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_ID\n" : "";
	errorString += DATABASE_URL ? "DATABASE_URL\n" : "";

	throw errorGen( "EnvError", `${ errorString }Please set the above .env variables in the project's .env file.` );

}