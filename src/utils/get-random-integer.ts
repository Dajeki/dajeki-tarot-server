/** @module utils/get-random-integer */

/**
 * @param {number} max - max value of the random number
 * @return {number} a number between 0 - max(exclusive)
 */ 
export function getRandomInt(max : number) : number{
	return Math.floor(Math.random() * max);
}