// @ts-ignore
import "./auth.css";

import { useState } from "react";
import { LoginInput, SignupInput, loginSchema, signupSchema } from "@app/common";
import { useMutation } from "@tanstack/react-query";
import { appTrpc } from "@/trpc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";


const AuthForm = ({ type, active, title, children, onSubmit }: any) => (
  <div className={`form ${type} ${active ? "active" : ""}`}>
    <h2>{title}</h2>
    <form onSubmit={onSubmit}>{children}</form>
  </div>
);

const Hero = ({ type, active, title, text, buttonText, onClick }: any) => (
  <div className={`hero ${type} ${active ? "active" : ""}`}>
    <h2>{title}</h2>
    <p>{text}</p>
    <button type="button" onClick={onClick}>
      {buttonText}
    </button>
  </div>
);

export default function Auth() {
  const [view, setView] = useState<"signup" | "signin">("signin");
  const isSignup = view === "signup";
  
  // tRPC Mutations
  const loginMutation = useMutation(appTrpc.login.mutationOptions( { onSuccess : () => {
      // Redirect or refresh session
      window.location.href = "/";
    }, onError : () => {
      window.alert("Login Failed") 
    } })
  );

  const signupMutation = useMutation(appTrpc.signup.mutationOptions({
    onSuccess : () => {
      setView("signin");
      window.alert("Sign up Success")
    },
    onError : () => {
      window.alert("Sign up Failed")
    }
  }))

  const { 
    register: regLogin, 
    handleSubmit: handleLogin, 
    formState: { errors: loginErrors } 
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const { 
    register: regSignup, 
    handleSubmit: handleSignup, 
    formState: { errors: signupErrors } 
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const onLoginSubmit = (data: LoginInput) => loginMutation.mutate(data);
  const onSignupSubmit = (data: SignupInput) => {
    signupMutation.mutate(data)
  };

  const toggleView = () => setView(isSignup ? "signin" : "signup");

  return (
    <section className="page login-page login">
      <div className="card">
        <div className="card-bg" style={{ translate: isSignup ? 0 : "100%" }} />

        {/* SIGN UP VIEW HERO */}
        <Hero
          type="signup"
          active={isSignup}
          title="Welcome Back!"
          text="Sign in to track your most recent investment gains."
          buttonText="SIGN IN"
          onClick={toggleView}
        />

        {/* SIGN UP FORM */}
        <AuthForm 
          type="signup" 
          active={isSignup} 
          title="Create Account"
          onSubmit={handleSignup(onSignupSubmit)}
        >
          <input {...regSignup("name")} type="text" placeholder="Name" />
          {signupErrors.name && <span className="error">{signupErrors.name.message}</span>}

          <input {...regSignup("email")} type="email" placeholder="Email" />
          {signupErrors.email && <span className="error">{signupErrors.email.message}</span>}
          
          <input {...regSignup("password")} type="password" placeholder="Password" />
          {signupErrors.password && <span className="error">{signupErrors.password.message}</span>}
          
          <input {...regSignup("confirmPassword")} type="password" placeholder="Confirm Password" />
          {signupErrors.confirmPassword && <span className="error">{signupErrors.confirmPassword.message}</span>}
          
          <button type="submit" style={{ cursor : "pointer"}}>SIGN UP</button>
        </AuthForm>

        {/* SIGN IN VIEW HERO */}
        <Hero
          type="signin"
          active={!isSignup}
          title="Hey There!"
          text="Start your journey here and begin earning right away."
          buttonText="SIGN UP"
          onClick={toggleView}
        />

        {/* SIGN IN FORM */}
        <AuthForm 
          type="signin" 
          active={!isSignup} 
          title="Sign In"
          onSubmit={handleLogin(onLoginSubmit)}
        >
          <input {...regLogin("email")} type="email" placeholder="Email" />
          {loginErrors.email && <span className="error">{loginErrors.email.message}</span>}
          
          <input {...regLogin("password")} type="password" placeholder="Password" />
          {loginErrors.password && <span className="error">{loginErrors.password.message}</span>}
          
          <button type="submit" style={{ cursor : "pointer"}} disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Logging in..." : "SIGN IN"}
          </button>
        </AuthForm>
      </div>
    </section>
  );
}
