import express from 'express';
import { Client } from 'pg';
// rest of the code remains same
const app = express();
const PORT = 8080;

app.get('/', (req, res) => {
	const client = new Client({
		connectionString: process.env.DATABASE_URL,
		ssl: {
		  rejectUnauthorized: false
		}
	  });
	  console.log(`${process.env.DATABASE_URL}`)
	  client.connect();
	  console.log("Does this work now please?")
	  
	  client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'cards' AND table_schema = 'public';`, (err, res) => {
		if (err) throw err;
		for (let row of res.rows) {
		  console.log(JSON.stringify(row));
		}
		client.end();
	  });
	  res.send(`Express + TypeScript Server`)
});

app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});