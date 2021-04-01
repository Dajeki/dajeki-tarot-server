import { QueryConfig } from 'pg';

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
		values: [elementType]
	} 
}

export function queryCardBySuit( suitType : TarotSuits ) : QueryConfig<TarotSuits[]> {	
	return {
		text:`SELECT  
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
		values: [suitType]
	} 
}

/**
 * @param {Set<number>} cardIds - An set of card ID's to have been selected
 * @return {QueryConfig<number[]> | undefined} Query Config object for {@link https://www.npmjs.com/package/pg|postgres (pg)} library
 */ 
export function queryCardByID( cardIds : Set<number> ) : QueryConfig<number[]> | undefined {

	try{
		if( cardIds.size <= 0 ) throw new Error("Cannot send an empty array.");
		if( cardIds.size  > 78 ) throw new Error("You cannot possibly select more than 78 cards as that is the max in the deck.");
	}
	catch(err) {
		console.log(err);
		return undefined;
	}

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
		WHERE public.cards.id = $1`

	//start iterator at one as it is included in the origional queryString. 
	for(let i = 1; i < cardIds.size ; ) {
		queryString += ` OR public.cards.id = $` + (++i);
	}
	queryString += ';'

	return {
		text: queryString,
		values: [...cardIds.keys()]
	} 
}
