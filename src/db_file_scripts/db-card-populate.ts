import csv from "csv-parse";
import fs from "fs";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

function promisfiedCSVParse(fileName: string): Promise<ITarotCSVRow[]> {
	const results: ITarotCSVRow[] = [];

	return new Promise((resolve, reject) => {
		fs.createReadStream(fileName)
			.pipe(csv())
			.on("data", (data: string[]) => {
				if (isNaN(Number(data[0]))) {
					return;
				}

				results.push({
					name: data[1],
					suitId: data[6],
					id: data[0],
					elementId: data[2],
					cardRank: data[3],
					upright: data[4],
					down: data[5]
				});
			})
			.on("end", () => {
				resolve(results);
			});
	});
}

async function insertCardsIntoDB() {
	let cards = await promisfiedCSVParse("Tarot.csv");

	console.log(process.env.DATABASE_URL);
	const client = new Client({
		connectionString: process.env.DATABASE_URL,
		ssl: {
			rejectUnauthorized: false
		}
	});

	client.connect();

	for (let cardIdx = 0; cardIdx < cards.length; cardIdx++) {
		
		let a = await client.query({
			text:
				"INSERT INTO public.cards(suit_id, element_id, card_rank, card_meaning_up, card_meaning_down, card_name) VALUES($1,$2,$3,$4,$5,$6)",
			values: [
				cards[cardIdx].suitId,
				cards[cardIdx].elementId,
				cards[cardIdx].cardRank,
				cards[cardIdx].upright,
				cards[cardIdx].down,
				cards[cardIdx].name
			]
		});
		console.log(`Inserted ${cards[cardIdx].name} into the DB.`);
	}

	client.end();
}
