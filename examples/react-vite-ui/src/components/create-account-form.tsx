import { useActionState } from "react";

export function CreateAccountForm({ onCreated }: { onCreated: (email: string, firstName: string, lastName: string) => Promise<unknown> }) {
   const [error, submitAction, pending] = useActionState(async (_: unknown, formData: FormData) => {
      const email = formData.get("email") as string;
      const firstName = formData.get("firstName") as string;
      const lastName = formData.get("lastName") as string;
      await onCreated(email, firstName, lastName);
      return null;
   }, null);

   return (
      <form className="form" action={submitAction}>
         <input name="email" placeholder="Email" required />
         <input name="firstName" placeholder="First name" required />
         <input name="lastName" placeholder="Last name" required />
         <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create"}
         </button>
         {error && <p className="form-error">{String(error)}</p>}
      </form>
   );
}
