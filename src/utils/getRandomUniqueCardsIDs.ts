import { getRandomInt } from "./getRandomInteger";

/**
 * @param {number} requestAmount - The amount of random numbers selected up to a maximum of 78
 * @return {number[]} a set containing exclusive numbers corrisponding to a cards id within a tarot deck selected at random from 0-77
 */
export function getRandomUniqueCardIDs( requestAmount : number ) : number[] {

	const randomSelectedCards: number[] = [];
	const numbersToChooseFrom: number[] = [...Array( 78 ).keys()]; // numbers 0 - 77 for keys
	let numSelectedToRemove: number;

	//Get a random ID from the numbersToChooseFrom, remove it, and place it into randomSelectedCards
	for( let i = 0; i < requestAmount; i++ ) {
		numSelectedToRemove = getRandomInt( numbersToChooseFrom.length );

		randomSelectedCards.push( numbersToChooseFrom[numSelectedToRemove] );

		//remove the currently selected number from the list of available numbers
		numbersToChooseFrom.splice( numSelectedToRemove, 1 );
	}

	return randomSelectedCards;
}

