type ErrorStateProps = {
  title?: string;
  message: string;
};

export function ErrorState({ title, message }: ErrorStateProps) {
  return (
    <div className="state state-error">
      <div>
        {title && <h1>{title}</h1>}
        <p>{message}</p>
      </div>
    </div>
  );
}
