import express from "express";
import { Pool, QueryResult } from "pg";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import cors from "cors";

import { returnRandomSelectedSet } from "./utils/return-random-selected-set";
import { queryCardByID, saveCardSpread, upsertUser } from "./pq-db-queries";
import rateLimit from "express-rate-limit";
//import { parseCookies } from "./utils/cookie-parser";

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

//Subscribe the rate limiter middleware for random cards endpoint
app.use( "/cards/:amount", rateLimit( optionsLimiter ));
app.use( "/cards/save_spread", express.json());

const PORT = parseInt( process.env.PORT || "0" );
const { GOOGLE_CLIENT_ID, DATABASE_URL } = process.env;

if( PORT && GOOGLE_CLIENT_ID && DATABASE_URL ) {

	const client = new OAuth2Client( GOOGLE_CLIENT_ID );

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

			if ( requestAmount > 78 ) {
				res.json( "{ \"error\": \"There are only 78 cards in a Tarot Deck.\"}" );
				return;
			}
			else if ( requestAmount < 1 ) {
				res.json( "{ \"error\": \"Please ask for at least 1 card.\"}" );
				return;
			}
			else if ( isNaN( requestAmount )) {
				res.json( "{ \"error\": \"The request card amount is not a number.\"}" );
				return;
			}

			const dbClient = await dbConnectionPool.connect();
			const queryParamsForID = queryCardByID( returnRandomSelectedSet( requestAmount ));
			const queryResults: QueryResult<CardDBResults> = await dbClient.query( queryParamsForID );

			dbClient.release();

			const directionalCards: CardDBResults[] = queryResults.rows.map( element => {
				if ( Math.random() * 10 >= 5 ) {
					delete element.card_meaning_up;
				}
				else {
					delete element.card_meaning_down;
				}
				return element;
			});

			res.json( directionalCards );
		})();
	});

	/**
	 * Login endpoint
	 * Currently verifies only Google 0Auth2 JWT -  https://developers.google.com/identity/sign-in/web/backend-auth#verify-the-integrity-of-the-id-token
	 */
	app.get( "/userInfo/login", ( req, res ) => {
		( async function () {

			const dbClient = await dbConnectionPool.connect();
			try {
				const JWT = req.headers.authorization?.split( " " )[1];
				const ticket = await client.verifyIdToken({
					idToken : JWT || "",
					audience: GOOGLE_CLIENT_ID,
				});

				const payload: TokenPayload | undefined = ticket.getPayload();

				console.log( `User ${ payload?.name } verified` );

				//Sub is UUID, given_name is either hidden or Full name and exp is token expiration time
				const { sub: userId, given_name = "", exp } = payload as TokenPayload;

				const [queryUpdateUser, queryInsertUser] = upsertUser({ username: given_name, id: userId });

				const updateQueryResults = await dbClient.query( queryUpdateUser );
				console.log( "Rows affected from update:", updateQueryResults.rowCount );

				if ( updateQueryResults.rowCount <= 0 ) {

					const insertQueryResults = await dbClient.query( queryInsertUser );
					console.log( "Rows affected from insert:", insertQueryResults.rowCount );

				}

				res.send( `Login sucessful for ${  given_name }` );
			}
			catch( err ) {
				res.json({ error: err });
			}
			finally {
				dbClient.release();
			}
		})();
	});

	/**
	 * Save spread endpoint that will require the user to be logged in to use.
	 * The request to this endpoint should be sent in JSON.
	 */
	app.put( "/cards/save_spread", ( req, res ) => {
		( async function () {

			const JWT = req.headers.authorization?.split( " " )[1] || "";
			const ticket = await client.verifyIdToken({
				idToken : JWT,
				audience: GOOGLE_CLIENT_ID,
			});
			const payload: TokenPayload | undefined = ticket.getPayload();

			const dbClient = await dbConnectionPool.connect();
			try{
				if ( payload == undefined ) {
					throw new Error( "Sent JWT is incorrect" );
				}
				console.log( `User ${ payload.name } verified for saving spread.` );

				const { sub: userId } = payload as TokenPayload;

				console.log( req.body.cards, userId, req.body.spreadId, req.body.spreadDir );
				const saveCardQuery = saveCardSpread( req.body.cards, userId, req.body.spreadId, req.body.spreadDir );
				const updateQueryResults = await dbClient.query( saveCardQuery );

				if ( updateQueryResults.rowCount === 0 ) {
					res.send( "Could not save in DB" );
				}

				console.log( `Saved User ${ payload.name }'s Spread.` );
				res.send( "Saved Spread!" );
			}
			catch ( err ) {
				console.log( err );
				res.json({ error: err });
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