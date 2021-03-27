import { QueryConfig } from 'pg';

function queryCardByElement( elementType : TarotElements ) : QueryConfig<TarotElements[]> {
	
	return {
		text: 
			`
				SELECT  public.cards.id,
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

function queryCardBySuit( suitType : TarotSuits ) : QueryConfig<TarotSuits[]> {
	
	return {
		text: 
			`
				SELECT  public.cards.id,
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