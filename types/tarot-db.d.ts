type TarotElements = "fire" | "water" | "air" | "earth";
type TarotSuits = "wand" | "cup" | "sword" | "pentacle" | "aether";

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