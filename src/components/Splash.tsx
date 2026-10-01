export function Splash() {
  return (
    <div className="bg-background fixed inset-0 z-[100] flex items-center justify-center">
      <div className="relative size-36">
        <div className="border-muted absolute inset-0 rounded-full border-2" />
        <div className="border-t-primary absolute inset-0 animate-spin rounded-full border-2 border-transparent [animation-duration:1.1s]" />
        <img
          src="/logo.png"
          alt=""
          draggable={false}
          className="absolute inset-0 m-auto size-24 rounded-3xl object-cover"
        />
      </div>
    </div>
  );
}
