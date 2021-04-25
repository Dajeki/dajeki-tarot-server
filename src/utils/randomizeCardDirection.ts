/**
 * @param {number[]} idOrder - id of cards that correspond to the same order the cards should be in.
 * @param {CardDbResults[]} cardList - list of cards to be put in the specified order of the idOrder array
 * @return {CardDbResults[]} cards in an array maintaining the order set by the idOrder parameter.
 */
export function randomDirectionOrdered( idOrder: number[], cardList: CardDBResults[] ) : CardDBResults[] {
	//random up or down direction by removing the property that isnt needed.
	const directionalCards: CardDBResults[] = cardList.map( element => {
		if( Math.random() * 10 >= 5 ) {
			delete element.card_meaning_up;
		}
		else {
			delete element.card_meaning_down;
		}
		return element;
	});

	//Put the query results for the cards back in the randomly selected order from earlier.
	const orderedCardResults = idOrder.map( val => directionalCards.find( CardResult => CardResult.id === val ));
	return orderedCardResults as CardDBResults[] || [];
}

