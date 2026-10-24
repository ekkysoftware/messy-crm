import type { MouseEventHandler } from 'react'

type ButtonVariant = 'primary' | 'danger'

interface ButtonProps {
  label: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit'
  variant?: ButtonVariant
  disabled?: boolean
  autoFocus?: boolean
}

/** The app's button: `label` is the whole content, `variant` picks the colour. */
export default function Button({
  label,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  autoFocus = false,
}: ButtonProps) {
  return (
    <button
      type={type}
      className={variant === 'danger' ? 'btn danger' : 'btn'}
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
    >
      {label}
    </button>
  )
}
