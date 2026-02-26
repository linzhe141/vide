import type { PropsWithChildren } from "react"
import { AnimatedWrapper } from "./animation"
import { Pre } from "../Pre/Pre"

export function A({ ...props }: PropsWithChildren) {
  return (
    <a {...props} target='_blank'>
      {props.children}
    </a>
  )
}

export function P({ ...props }: PropsWithChildren) {
  return (
    <p className='break-words' {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </p>
  )
}

export function H1({ ...props }: PropsWithChildren) {
  return (
    <h1 {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </h1>
  )
}

export function H2({ ...props }: PropsWithChildren) {
  return (
    <h2 {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </h2>
  )
}

export function H3({ ...props }: PropsWithChildren) {
  return (
    <h3 {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </h3>
  )
}

export function Li({ ...props }: PropsWithChildren) {
  return (
    <li {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </li>
  )
}

export function Strong({ ...props }: PropsWithChildren) {
  return (
    <strong {...props}>
      <AnimatedWrapper>{props.children}</AnimatedWrapper>
    </strong>
  )
}

export const components = {
  // a: A,
  // p: P,
  // h1: H1,
  // h2: H2,
  // h3: H3,
  // li: Li,
  // strong: Strong,
  pre: Pre,
}