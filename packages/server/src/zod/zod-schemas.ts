// import z from "zod";

// export const loginSchema = z.object({
//   email: z.email("Invalid email address"),
//   password: z.string().min(6, "Password must be at least 6 characters"),
// });

// export const signupSchema = loginSchema.extend({
//   confirmPassword: z.string()
// }).refine((data) => data.password === data.confirmPassword, {
//   message: "Passwords don't match",
//   path: ["confirmPassword"],
// });

// export type LoginInput = z.infer<typeof loginSchema>;
// export type SignupInput = z.infer<typeof signupSchema>;