"use client";

interface RecommendationCardProps {
  title:        string;
  action:       string;
  rupeesImpact: number;
  product?:     string;
  isNew?:       boolean;
  onSimulate?:  () => void;
}

export function RecommendationCard({
  title, action, rupeesImpact, product, isNew, onSimulate,
}: RecommendationCardProps) {
  return (
    <div
      className="clay-card p-4 transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          {isNew && (
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mr-2"
              style={{ background: "rgba(234,122,34,0.12)", color: "var(--color-primary-500)" }}
            >
              New
            </span>
          )}
          {product && (
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
            >
              {product}
            </span>
          )}
        </div>
        <div
          className="shrink-0 px-3 py-1 text-sm font-black"
          style={{
            borderRadius: "var(--radius-pill)",
            background: rupeesImpact > 0 ? "rgba(47,158,95,0.12)" : "rgba(214,79,69,0.10)",
            color: rupeesImpact > 0 ? "var(--color-success)" : "var(--color-error)",
          }}
        >
          {rupeesImpact > 0 ? "+" : ""}₹{Math.abs(rupeesImpact).toLocaleString("en-IN")}
        </div>
      </div>

      <p className="text-sm font-bold mb-1" style={{ color: "var(--color-text-strong)" }}>
        {title}
      </p>
      <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--color-text-muted)" }}>
        {action}
      </p>

      {onSimulate && (
        <button
          onClick={onSimulate}
          className="text-xs font-bold px-3 py-1.5 transition-all duration-150 hover:opacity-80"
          style={{
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface-2)",
            color: "var(--color-text-base)",
          }}
        >
          Simulate Impact →
        </button>
      )}
    </div>
  );
}

interface RecommendationFeedProps {
  recommendations: Array<{
    id:           number;
    title:        string;
    action:       string;
    rupees_impact: number;
    product_name?: string;
  }>;
  onSimulate?: (id: number) => void;
}

export default function RecommendationFeed({ recommendations, onSimulate }: RecommendationFeedProps) {
  if (recommendations.length === 0) {
    return (
      <div
        className="clay-card p-8 text-center"
        style={{ color: "var(--color-text-soft)" }}
      >
        <p className="text-3xl mb-2">💡</p>
        <p className="text-sm font-semibold">Abhi koi recommendations nahi</p>
        <p className="text-xs mt-1">SmartDukaan se koi sawaal poochho</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec, i) => (
        <RecommendationCard
          key={rec.id}
          title={rec.title}
          action={rec.action}
          rupeesImpact={rec.rupees_impact}
          product={rec.product_name}
          isNew={i === 0}
          onSimulate={onSimulate ? () => onSimulate(rec.id) : undefined}
        />
      ))}
    </div>
  );
}
