import express from "express";
import { Pool, QueryResult } from "pg";
import { OAuth2Client, TokenPayload } from "google-auth-library";

import rateLimit from "express-rate-limit";
import cors from "cors";

import { getRandomUniqueCardIDs } from "./utils/getRandomUniqueCardsIDs";
import { getCardsByIDQueryGen, saveCardSpreadQueryGen, upsertUserQueryGen } from "./pq-db-queries";

const app = express();

const optionsCors: cors.CorsOptions = {
	credentials      : true,
	methods          : "GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE",
	origin           : "https://localhost:3000",
	preflightContinue: false,
};

app.use( cors( optionsCors ));

const optionsLimiter: rateLimit.Options = {
	windowMs: 60 * 1000, //1 Minute
	max     : 100,
	message : "{\"error\": \"Too many calls to this endpoint. You are limited to 100 per minute.\"}",
};

app.use( rateLimit( optionsLimiter ));

//save_spread enpoint is going to come as a JSON object from the front end.
app.use( "/cards/save_spread", express.json());

const PORT = parseInt( process.env.PORT || "0" );
const { GOOGLE_CLIENT_ID, DATABASE_URL } = process.env;

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
				throw new Error( "No JWT sent with request." );
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
	app.get( "/cards/:amount", ( req, res ) => {
		( async function () {

			const requestAmount = parseInt( req.params.amount );

			if( requestAmount > 78 ) {
				res.json( "{ \"error\": \"There are only 78 cards in a Tarot Deck.\"}" );
				return;
			}
			else if( requestAmount < 1 ) {
				res.json( "{ \"error\": \"Please ask for at least 1 card.\"}" );
				return;
			}
			else if( isNaN( requestAmount )) {
				res.json( "{ \"error\": \"The request card amount is not a number.\"}" );
				return;
			}

			const dbClient = await dbConnectionPool.connect();
			const queryParamsForID = getCardsByIDQueryGen( getRandomUniqueCardIDs( requestAmount ));
			const queryResults: QueryResult<CardDBResults> = await dbClient.query( queryParamsForID );

			dbClient.release();

			//random up or down direction by removing the property that isnt needed.
			const directionalCards: CardDBResults[] = queryResults.rows.map( element => {
				if( Math.random() * 10 >= 5 ) {
					delete element.card_meaning_up;
				}
				else {
					delete element.card_meaning_down;
				}
				return element;
			});

			const idOrder = queryParamsForID.values || [];
			//Put the query results for the cards back in the randomly selected order from earlier.
			const orderedCardResults = idOrder.map( val => directionalCards.find( CardResult => CardResult.id === val ));

			res.json( orderedCardResults );
		})();
	});

	/**
	 * Login endpoint
	 * Currently verifies only Google 0Auth2 JWT -  https://developers.google.com/identity/sign-in/web/backend-auth#verify-the-integrity-of-the-id-token
	 */
	app.post( "/userInfo/login", ( req, res ) => {
		( async function () {
			const dbClient = await dbConnectionPool.connect();

			try {
				if( !req.googleTokenPayload ) {
					throw new Error( "Google JWT Error." );
				}
				//Sub is UUID, given_name is either hidden or Full name
				const { sub: userId, given_name = "" } = req.googleTokenPayload;
				const [queryUpdateUser, queryInsertUser] = upsertUserQueryGen({ username: given_name, id: userId });

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
				dbClient.release();
			}
		})();
	});


	/**
	 * Save spread endpoint that will require the user to be logged in to use.
	 * The request to this endpoint body should be sent in JSON as the body will be parsed as such.
	 */
	app.put( "/cards/save_spread", ( req, res ) => {
		( async function () {

			const dbClient = await dbConnectionPool.connect();
			try {
				if( !req.googleTokenPayload ) {
					throw new Error( "Not logged in or incorrect token sent with response." );
				}

				const { sub: userId } = req.googleTokenPayload;

				//Check to make sure that a spread has not been saved today by querying the saved spread db.
				const savedAlready =  await dbClient.query({
					text  : "SELECT public.user_draws.date_drawn FROM public.user_draws WHERE public.user_draws.date_drawn = $1",
					values: [new Date().toUTCString()],
				});
				if( savedAlready.rowCount > 0 ) {
					console.log();
					throw new Error( "Only one spread can be saved per day." );
				}

				const saveCardQuery = saveCardSpreadQueryGen( req.body.cards, userId, req.body.spreadId, req.body.spreadDir );
				const saveQueryResults = await dbClient.query( saveCardQuery );

				if( saveQueryResults.rowCount === 0 ) {
					//Check to make sure the body is what we expected.
					console.log( req.body.cards, userId, req.body.spreadId, req.body.spreadDir );
					throw new Error( "DB connected but query did not execute." );
				}

				console.log( "Saved User's Spread." );
				res.json({ success: "Saved Spread!" });
			}
			catch( err ) {
				res.status( 500 ).json({
					error    : ( err as Error ).message,
					availDate: new Date( Date.now() + 86_400_000 ).getTime(),
				});
			}
			finally {
				dbClient.release();
			}
		})();
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

	throw new Error( `${ errorString }Please set the above .env variables in the project's .env file.` );

}