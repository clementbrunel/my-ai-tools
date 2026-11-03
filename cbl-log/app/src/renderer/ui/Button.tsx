import "./Button.css";
import type { ButtonHTMLAttributes } from "react";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** primary: the main action of the dialog; default: secondary; ghost: compact icon button (×, delete, clear). */
  variant?: "primary" | "default" | "ghost";
  type?: "button" | "submit";
}

/** The button of every modal: same size, radius, hover / focus / disabled states, in light and dark. */
export function Button({ variant = "default", type = "button", className, ...rest }: Props) {
  return <button type={type} className={className ? `btn btn-${variant} ${className}` : `btn btn-${variant}`} {...rest} />;
}
