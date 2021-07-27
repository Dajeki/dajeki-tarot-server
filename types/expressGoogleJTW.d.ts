import { TokenPayload } from "google-auth-library";

//Adding the googleTokenPayload to the express Request interface
declare module "express-serve-static-core" {
	interface Request {
		googleTokenPayload?: TokenPayload
	}
}

//Declaration Merging