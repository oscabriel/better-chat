import { generateVerificationCodeEmail } from "../utils/verification-code-email";

export const renderVerificationCodeEmail = async (
	otp: string,
): Promise<string> => {
	return generateVerificationCodeEmail({ otp });
};

export { generateVerificationCodeEmail as VerificationCodeEmail } from "../utils/verification-code-email";
