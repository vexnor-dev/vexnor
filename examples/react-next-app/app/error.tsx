"use client";

export default function Error({ error }: { error: Error }) {
   const lines = error.message.split("\nCaused by: ");

   return (
      <div className="max-w-6xl mx-auto px-6 py-10">
         <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-5 space-y-1">
            <p className="font-medium text-red-700 mb-2">Something went wrong</p>
            {lines.map((line, i) => (
               <p key={i} className="text-sm text-red-500 font-mono">
                  {i > 0 && <span className="text-red-300 select-none">{"  ".repeat(i)}↳ </span>}
                  {line}
               </p>
            ))}
         </div>
      </div>
   );
}
