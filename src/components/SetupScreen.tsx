export function SetupScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <img src="/assets/logo.png" alt="Fusion Steps" className="w-32 h-32 mb-6 rounded-full" />
      <h1 className="font-['Dancing_Script'] text-3xl text-[#00BCD4] mb-2">Fusion Steps</h1>
      <p className="text-white/50 mb-8">by Sriparna Dutta</p>
      <div className="bg-white/5 rounded-2xl p-6 max-w-md">
        <h2 className="text-lg font-semibold mb-4">Firebase Not Configured</h2>
        <p className="text-white/60 text-sm mb-4">
          To get started, create a Firebase project and add your config to a <code className="text-[#00BCD4]">.env</code> file.
        </p>
        <ol className="text-left text-sm text-white/60 space-y-2 list-decimal list-inside">
          <li>Go to the Firebase Console and create a new project</li>
          <li>Enable Authentication (Email/Password)</li>
          <li>Create a Firestore database</li>
          <li>Enable Storage</li>
          <li>Copy <code className="text-[#00BCD4]">.env.example</code> to <code className="text-[#00BCD4]">.env</code> and fill in your Firebase config</li>
          <li>Restart the dev server</li>
        </ol>
      </div>
    </div>
  )
}
