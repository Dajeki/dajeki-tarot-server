import { QueryConfig } from "pg";

/**
 * @param {TarotElement} elementType - Element type enum for tarot cards corresponding to Fire,Water,Air,Earth
 * @return {QueryConfig<TarotSuits[]> | undefined} Query Config object for {@link https://www.npmjs.com/package/pg|postgres (pg)} library with 	   	 supplied tarot element parameter and query constrained to a specific element.
 */
export function queryCardByElement( elementType : TarotElements ) : QueryConfig<TarotElements[]> {
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
export function queryCardBySuit( suitType : TarotSuits ) : QueryConfig<TarotSuits[]> {
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
 * @param {Set<number>} cardIds - An set of card ID's to have been selected
 * @return {QueryConfig<number[]> | undefined} Query Config object for {@link https://www.npmjs.com/package/pg|postgres (pg)} library with a 	   	 supplied set of numbers between 0-77 to query from the db.
 */
export function queryCardByID( cardIds : Set<number> ) : QueryConfig<number[]> {

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
	for( let i = 1; i < cardIds.size; ) {
		queryString += ` OR public.cards.id = $${ ++i }`;
	}
	queryString += ";";

	console.log( queryString );
	console.log( ...cardIds.keys());

	return {
		text  : queryString,
		values: [...cardIds.keys()],
	};
}
