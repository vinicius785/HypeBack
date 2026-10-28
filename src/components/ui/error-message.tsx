interface ErrorMessageProps {
  message: string;
  className?: string;
}

export function ErrorMessage({ message, className = "" }: ErrorMessageProps) {
  return (
    <p role="alert" className={`text-xs text-neutral-500 ${className}`}>
      {message}
    </p>
  );
}
