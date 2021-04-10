import express from "express";
import { Pool } from "pg";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import cors from "cors";

import { returnRandomSelectedSet } from "./utils/return-random-selected-set";
import { queryCardByID, upsertUser } from "./pq-db-queries";
import rateLimit from "express-rate-limit";

const app = express();

const optionsCors: cors.CorsOptions = {
	allowedHeaders: [
		"Origin",
		"X-Requested-With",
		"Content-Type",
		"Accept",
		"X-Access-Token",
		"Authorization",
	],
	credentials      : true,
	methods          : "GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE",
	origin           : "http://localhost:3000",
	preflightContinue: false,
};

app.use( cors( optionsCors ));

const optionsLimiter: rateLimit.Options = {
	windowMs: 60 * 1000, //1 Minute
	max     : 20,
	message : "{\"error\": \"Too many calls to this endpoint. You are limited to 5 per minute.\"}",
};

//Subscribe the rate limiter middleware for random cards endpoint
app.use( "/cards/:amount", rateLimit( optionsLimiter ));

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

			const dbClient = await dbConnectionPool.connect();
			const queryParamsForID = queryCardByID( returnRandomSelectedSet( requestAmount ));
			const queryResults = await dbClient.query( queryParamsForID );

			dbClient.release();

			res.json( queryResults.rows );
		})();
	});

	/**
	 * Login endpoint
	 * Currently verifies only Google 0Auth2 JWT -  https://developers.google.com/identity/sign-in/web/backend-auth#verify-the-integrity-of-the-id-token
	 * TODO: maintain sub and full name in the backend for tarot spread information retreival in the frontend.
	 */
	app.get( "/userInfo/login", ( req, res ) => {
		( async function () {

			const dbClient = await dbConnectionPool.connect();
			try {

				const ticket = await client.verifyIdToken({
					idToken : req.headers.authorization?.split( " " )[1] || "",
					audience: GOOGLE_CLIENT_ID,
				});

				const payload: TokenPayload | undefined = ticket.getPayload();

				console.log( "payload:", payload );
				console.log( `User ${ payload?.name } verified` );

				const { sub : userId, email, name = "", picture } = payload as TokenPayload;
				const [queryUpdateUser, queryInsertUser] = upsertUser({ username: name, id: userId });

				const updateQueryResults = await dbClient.query( queryUpdateUser );
				console.log( "Rows affected from update:", updateQueryResults.rowCount );

				if ( updateQueryResults.rowCount <= 0 ) {

					const insertQueryResults = await dbClient.query( queryInsertUser );
					console.log( "Rows affected from insert:", insertQueryResults.rowCount );

				}

				res.send( `${ userId }\n${ email }\n${ name }\n<img src="${ picture }"/>` );

			}
			catch( err ) {
				res.json( `{ "error":${ err }` );
			}
			finally {
				dbClient.release();
			}
		})();
	});


	app.listen( PORT, () => {
		console.log( `⚡️[server]: Server is running at https://localhost:${ PORT }` );
	});

}
else {

	let errorString = "";
	errorString += PORT ? "PORT\n" : "";
	errorString += GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_ID\n" : "";
	errorString += DATABASE_URL ? "DATABASE_URL\n" : "";

	throw new Error( `${ errorString }Please set the above .env variables in the project's .env file.` );

}