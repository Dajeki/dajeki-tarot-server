import { QueryConfig } from "pg";

/**
 * @param {TarotElement} elementType - Element type enum for tarot cards corresponding to Fire,Water,Air,Earth
 * @return {QueryConfig<TarotSuits[]> | undefined} Query Config object for {@link https://www.npmjs.com/package/pg|postgres (pg)} library with 	   	 supplied tarot element parameter and query constrained to a specific element.
 */
export function getCardByElementQueryGen( elementType : TarotElements ) : QueryConfig<TarotElements[]> {
	return {
		text: `SELECT  
				public.cards.card_name
				public.cards.id,
				public.cards.card_rank,
				public.cards.card_meaning_up,
				public.cards.card_meaning_down,
				public.elements.element,
				public.suits.suit
			FROM public.cards
			INNER JOIN public.elements ON public.cards.element_id = public.elements.id
			INNER JOIN public.suits ON public.cards.suit_id = public.suits.id
			WHERE public.elements.element = $1;`,
		values: [elementType],
	};
}

/**
 * @param {TarotSuits} suitType - Suit type enum for tarot cards corresponding to Wands,Cups,Swords,Pentacles,Aether
 * @return {QueryConfig<TarotSuits[]> | undefined} Query Config object for {@link https://www.npmjs.com/package/pg|postgres (pg)} library with 	   	 supplied tarot suit parameter and query constrained to a specific suit.
 */
export function getCardBySuitQueryGen( suitType : TarotSuits ) : QueryConfig<TarotSuits[]> {
	return {
		text: `SELECT  
				public.cards.card_name,
				public.cards.id,
				public.cards.card_rank,
				public.cards.card_meaning_up,
				public.cards.card_meaning_down,
				public.elements.element,
				public.suits.suit
			FROM public.cards
			INNER JOIN public.elements ON public.cards.element_id = public.elements.id
			INNER JOIN public.suits ON public.cards.suit_id = public.suits.id
			WHERE public.suits.suit = $1;`,
		values: [suitType],
	};
}

/**
 * @param {number[]} cardIds - An set of unique card ID's to have been selected
 * @return {QueryConfig<number[]> | undefined} Query Config object for {@link https://www.npmjs.com/package/pg|postgres (pg)} library with a 	   	 supplied set of numbers between 0-77 to query from the db.
 */
export function getCardsByIDQueryGen( cardIds : number[] ) : QueryConfig<number[]> {

	let queryString = `SELECT
			public.cards.card_name,
			public.cards.id,
			public.cards.card_rank,
			public.cards.card_meaning_up,
			public.cards.card_meaning_down,
			public.elements.element,
			public.suits.suit
		FROM public.cards
		INNER JOIN public.elements ON public.cards.element_id = public.elements.id
		INNER JOIN public.suits ON public.cards.suit_id = public.suits.id
		WHERE public.cards.id = $1`;

	//start iterator at one as it is included in the origional queryString.
	for( let i = 1; i < cardIds.length; ) {
		queryString += ` OR public.cards.id = $${ ++i }`;
	}
	queryString += ";";

	return {
		text  : queryString,
		values: cardIds,
	};
}

/**
 * @param {DajekiTarotUser} DajekiTarotUser - An object containing the {username, id} properties.
 * @param {username} DajekiTarotUser.username - Username is the full name supplied to Google OAuth
 * @param {id} DajekiTarotUser.id - UUID(sub) supplied from the Google OAuth
 * @return {QueryConfig<(string | number)[]>[]} Arry of Query Config objects for {@link https://www.npmjs.com/package/pg|postgres (pg)} library with the first index(0) being the update query and the second index(1) being the insert.
 */
export function upsertUserQueryGen({ username, id }: DajekiTarotUser ): QueryConfig<( string | number )[]>[] {

	const queryStringUpdate = "UPDATE users SET username = $1 WHERE id = $2";
	const queryStringInsert = "INSERT INTO users (id, username) VALUES ($1, $2)";

	return [
		{
			text  : queryStringUpdate,
			values: [username, id],
		},
		{
			text  : queryStringInsert,
			values: [id, username],
		},
	];
}

/**
 * @param {number[]} cardIds - An array of cardIds from the request body.
 * @param {string} userId - sub UUID from the google OAuth
 * @param {number} spreadId - spreadId from the request body json object.
 * @param {string} spreadDirection - A string of 0 and 1's representing 1 for up or 0 for down.
 * @return {QueryConfig<number[]> | undefined} Query Config object for {@link https://www.npmjs.com/package/pg|postgres (pg)} library with required entry into the saved spreads db.
 */
export function saveCardSpreadQueryGen( cardIds : number[], userId : string, spreadId : number, spreadDirection: string  ) : QueryConfig<( string | number | Date )[]> {

	const queryString = `INSERT INTO
			public.user_draws(user_id, spread_meaning_id, card_one_id, card_two_id, card_three_id, date_drawn, direction)
			VALUES ( $1 , $2, $3, $4, $5, $6, $7);`;

	return {
		text  : queryString,
		values: [userId, spreadId, ...cardIds, new Date().toUTCString(), spreadDirection ],
	};
}

/**
 * @param {string} userId - ID of the user to return spreads for
 * @return {QueryConfig<string> | undefined} Query Config object for {@link https://www.npmjs.com/package/pg|postgres (pg)} library with a supplied userId to get previous saved spreads for.
 */
export function getPastSavedSpreadsQueryGen( userId : string ) : QueryConfig<string[]> {
	const queryString = `SELECT
			public.user_draws.id,
			public.user_draws.date_drawn,
			public.spread_meanings.card_one_spread_meaning,
			public.spread_meanings.card_two_spread_meaning,
			public.spread_meanings.card_three_spread_meaning,
			public.user_draws.direction,
			public.cards.card_name,
			public.cards.id as cards_id,
			public.cards.card_meaning_up,
			public.cards.card_meaning_down,
			public.elements.element,
			public.suits.suit
		FROM public.user_draws
		INNER JOIN public.cards ON
			public.user_draws.card_one_id = public.cards.id OR
			public.user_draws.card_two_id = public.cards.id OR
			public.user_draws.card_three_id = public.cards.id
		INNER JOIN public.elements ON public.cards.element_id = public.elements.id
		INNER JOIN public.suits ON public.cards.suit_id = public.suits.id
		INNER JOIN public.spread_meanings ON public.user_draws.spread_meaning_id = public.spread_meanings.id
		WHERE public.user_draws.user_id = $1
		ORDER BY public.user_draws.date_drawn; `;

	return {
		text  : queryString,
		values: [userId],
	};
}
