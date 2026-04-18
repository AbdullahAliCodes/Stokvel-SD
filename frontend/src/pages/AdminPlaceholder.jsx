export default function AdminPlaceholder({ title }) {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold tracking-wide text-emerald-800">
        {title}
      </h1>
      <div className="mt-8 text-stone-500 italic">No information available</div>
    </div>
  )
}
