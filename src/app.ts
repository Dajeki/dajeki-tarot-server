import express from "express";
import { Pool } from "pg";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import cors from "cors";

import { getRandomInt } from "./utils/get-random-integer";
import { queryCardByID } from "./pq-db-queries";
import rateLimit from "express-rate-limit";

// rest of the code remains same
const app = express();

const options: cors.CorsOptions = {
	allowedHeaders: [
		"Origin",
		"X-Requested-With",
		"Content-Type",
		"Accept",
		"X-Access-Token",
		"Authorization"
	],
	credentials: true,
	methods: "GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE",
	origin: "http://localhost:3000",
	preflightContinue: false
};

app.use(cors(options));

const PORT = 8080;
const googleClientId =
	"914582580489-tms667vjlg9nq2n7c2rkjfbadsk2bsrp.apps.googleusercontent.com";

const client = new OAuth2Client(googleClientId);

const dbConnectionPool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: {
		rejectUnauthorized: false
	}
});

// app.get("/", (req, res) => {
// 	(async function () {
// 		const client = await dbConnectionPool.connect();

// 		try {
// 			let queryResults = await client.query(queryCardByElement("fire"));
// 			for (let row of queryResults.rows) {
// 				console.log(row);
// 			}
// 		} finally {
// 			client.release();
// 		}

// 		res.send(`Express + TypeScript Server`);
// 	})();
// });

const limiter = rateLimit({
	windowMs: 60 * 1000, //1 Minute
	max: 5,
	message: "Too many calls to this endpoint. You are limited to 5 per minute."
});

app.use("/cards/:amount", limiter);
/*
 * Cards db access
 */
app.get("/cards/:amount", (req, res) => {
	(async function () {
		const client = await dbConnectionPool.connect();
		console.log(req.params.amount);

		const requestAmount = parseInt(req.params.amount);
		let randomSelectedCards: number[] = [];
		let numbersToChooseFrom: number[] = Array(78).fill(0); // numbers 0 - 77 as keys

		let numSelectedToRemove: number;

		for (let i = 0; i < requestAmount; i++) {
			numSelectedToRemove = getRandomInt(numbersToChooseFrom.length);
			randomSelectedCards.push(numSelectedToRemove);

			//remove the currently selected number from the list of available numbers
			delete numbersToChooseFrom[numSelectedToRemove];
		}

		let QueryParamsForID = queryCardByID(new Set(randomSelectedCards));
		console.log(QueryParamsForID);

		if (QueryParamsForID !== undefined) {
			try {
				let queryResults = await client.query(QueryParamsForID);
				for (let row of queryResults.rows) {
					console.log(row);
				}

				res.setHeader("content-type", "application/json; charset=utf-8");
				res.send(JSON.stringify(queryResults.rows));
			} finally {
				client.release();
			}
		}
	})();
});

app.get("/userInfo/login", (req, res) => {
	(async function () {
		try {
			const ticket = await client.verifyIdToken({
				idToken: req.headers.authorization?.split(" ")[1] || "",
				audience: googleClientId
			});

			const payload: TokenPayload | undefined = ticket.getPayload();

			console.log("payload:", payload);
			console.log(`User ${payload?.name} verified`);

			const { sub, email, name, picture } = payload as TokenPayload;
			const userId = sub;

			res.send(`${userId}\n${email}\n${name}\n<img src="${picture}"/>`);
		} catch {
			res.send("Login Information Malformed");
		}
	})();
});

app.listen(PORT, () => {
	console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});
