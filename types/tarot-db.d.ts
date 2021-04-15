type TarotElements = "fire" | "water" | "air" | "earth";
type TarotSuits = "wand" | "cup" | "sword" | "pentacle" | "aether";

type CardDBResults = {
	id					: number,
	suit_id				: number,
	element_id			: number,
	card_rank			: number,
	card_meaning_up		?: string,
	card_meaning_down	?: string,
	card_name			: string,
}

/**
 * An object containing name supplied to Google by the user and a UUID supplied by Google OAuth
 */
type DajekiTarotUser = {
	username: string,

	/**
	 * This is the 'sub' property on the Google JWT
	 */
	id		: string
}