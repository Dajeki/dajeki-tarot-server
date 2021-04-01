import { QueryConfig } from 'pg';

export function queryCardByElement( elementType : TarotElements ) : QueryConfig<TarotElements[]> {
	
	return {
		text: 
			`
				SELECT  public.cards.card_name
						public.cards.id,
						public.cards.card_rank,
						public.cards.card_meaning_up,
						public.cards.card_meaning_down,
						public.elements.element,
						public.suits.suit
				FROM public.cards
				INNER JOIN public.elements ON public.cards.element_id = public.elements.id
				INNER JOIN public.suits ON public.cards.suit_id = public.suits.id
				WHERE public.elements.element = $1;
			`,
		values: [elementType]
	} 
}

export function queryCardBySuit( suitType : TarotSuits ) : QueryConfig<TarotSuits[]> {
	
	return {
		text: 
			`
				SELECT  public.cards.card_name,
						public.cards.id,
						public.cards.card_rank,
						public.cards.card_meaning_up,
						public.cards.card_meaning_down,
						public.elements.element,
						public.suits.suit
				FROM public.cards
				INNER JOIN public.elements ON public.cards.element_id = public.elements.id
				INNER JOIN public.suits ON public.cards.suit_id = public.suits.id
				WHERE public.suits.suit = $1;
			`,
		values: [suitType]
	} 
}

export function queryCardByID( amountReturn : number, cardIds : number[] ) : QueryConfig<number[]> | undefined {

	try{
		if( amountReturn <= 0 ) throw new Error("Amount returned must be greater than 0");
		if( cardIds.length < amountReturn ) throw new Error("Not enough card ID's inside array to satisfy enough cards to return");
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

	//start iterator as one as it is included in the origional queryString. 
	for(let i = 1; i < amountReturn; ) {
		queryString += ` OR public.cards.id = $` + (++i);
	}

	queryString += ';'

	return {
		text: queryString,
		values: cardIds
	} 
}
