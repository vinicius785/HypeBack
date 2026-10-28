interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner = ({
  message = "Carregando...",
}: LoadingSpinnerProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-050">
      <div className="w-full max-w-md flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-600/20 border-t-primary-600" />

        <p className="text-neutral-700 text-base font-regular animate-pulse">
          {message}
        </p>
      </div>
    </div>
  );
};
