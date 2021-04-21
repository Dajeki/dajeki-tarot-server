/**
 * @param {string} name - The name of the id that can be used to check against in the catch clause.
 * @param {string} message - Information about the error to be displayed for debugging purposes.
 * @return {Error} An error to be thrown.
 */
export function errorGen( name: string, message: string ): Error {
	const tokenError = new Error( message );
	tokenError.name = name;
	return tokenError;
}