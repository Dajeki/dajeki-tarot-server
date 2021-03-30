import express, { Router } from 'express';
import { Client } from 'pg';
import {queryCardByElement} from './pq-db-queries';
import { IdTokenClient, OAuth2Client, TokenInfo, TokenPayload } from 'google-auth-library';
import cors from 'cors';

// rest of the code remains same
const app = express();

const options: cors.CorsOptions = {
	allowedHeaders: [
	  'Origin',
	  'X-Requested-With',
	  'Content-Type',
	  'Accept',
	  'X-Access-Token',
	  'Authorization'
	],
	credentials: true,
	methods: 'GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE',
	origin: "http://localhost:3000",
	preflightContinue: false,
  };

app.use(cors(options));

const PORT = 8080;
const googleClientId = '914582580489-tms667vjlg9nq2n7c2rkjfbadsk2bsrp.apps.googleusercontent.com'

const client = new OAuth2Client(googleClientId);

let a = 54;

app.get('/', (req, res) => {

	(async function() {

		const client = new Client({
				connectionString: process.env.DATABASE_URL,
				ssl: {
					rejectUnauthorized: false
				} 
			});
			
			client.connect();
	
			let queryResults = await client.query( queryCardByElement('fire'));
	
			for (let row of queryResults.rows) {
				console.log(row);
			}
				
			client.end();
	
			res.send(`Express + TypeScript Server`);

	})();
	
});

app.get('/getLogonInfo', (req, res) => {

	(async function() {

		const ticket = await client.verifyIdToken({
			idToken: req.headers.authorization?.split(' ')[1] || '',
			audience: googleClientId
		})

		const payload : TokenPayload | undefined = ticket.getPayload();
		console.log('payload:', payload);

		console.log(`User ${payload?.name} verified`);

		const { sub , email, name, picture } = payload as TokenPayload;
		const userId = sub;
		// res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
		// res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		res.send(`${userId}\n${email}\n${name}\n<img src="${picture}"/>`);

	})();
	
})

app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});