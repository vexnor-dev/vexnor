import * as readline from "readline";

export async function confirmPrompt(
   message: string,
   requireYes = false,
   createInterface = readline.createInterface,
): Promise<boolean> {
   const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
   });

   const prompt = requireYes ? `${message} (type 'yes' to confirm): ` : `${message} (y/N): `;

   return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
         rl.close();
         if (requireYes) {
            resolve(answer === "yes");
         } else {
            resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
         }
      });
   });
}
