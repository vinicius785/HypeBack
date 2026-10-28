import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  buildAudienceBarSeries,
  topAgeBracketLabel,
  type AudienceBarSeries,
  type AudienceNetworkAgeData,
} from "@/shared/services/metrics";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const NETWORK_COLOR = {
  instagram: "#278cff",
  youtube: "#ff633c",
} as const;

const barDemographicsOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#f9f9f9",
      titleColor: "#202020",
      bodyColor: "#202020",
      padding: 10,
      cornerRadius: 4,
      displayColors: true,
      boxPadding: 4,
      boxWidth: 8,
      callbacks: {
        title(items) {
          return items[0]?.label ?? "";
        },
        label(ctx) {
          const label = ctx.dataset.label ?? "";
          const v = ctx.parsed.y;
          return `${label}: ${v}%`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#202020", font: { size: 16 } },
    },
    y: {
      beginAtZero: true,
      max: 100,
      grid: { color: "#d8d8d8" },
      ticks: {
        color: "#646464",
        callback: (v) => `${v}%`,
      },
    },
  },
};

/**
 * Datasets do gráfico — apenas as redes com faixas etárias reais.
 * Rede sem dados não vira barra zerada nem legenda.
 */
export function buildDemographicsDatasets(series: AudienceBarSeries) {
  const datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string;
    borderRadius: number;
    borderSkipped: false;
    maxBarThickness: number;
  }> = [];
  const base = {
    borderRadius: 12,
    borderSkipped: false as const,
    maxBarThickness: 36,
  };
  if (series.hasInstagram) {
    datasets.push({
      label: "Instagram",
      data: series.instagram,
      backgroundColor: NETWORK_COLOR.instagram,
      ...base,
    });
  }
  if (series.hasYoutube) {
    datasets.push({
      label: "Youtube",
      data: series.youtube,
      backgroundColor: NETWORK_COLOR.youtube,
      ...base,
    });
  }
  return datasets;
}

export function DemographicsBarChart({ series }: { series: AudienceBarSeries }) {
  const chartData = {
    labels: series.labels,
    datasets: buildDemographicsDatasets(series),
  };

  return <Bar data={chartData} options={barDemographicsOptions} />;
}

export function AudienceByAgePanel({
  networks,
}: {
  networks?: Record<string, AudienceNetworkAgeData> | undefined;
}) {
  const series = useMemo(() => buildAudienceBarSeries(networks), [networks]);

  const topInstagramAge = useMemo(
    () =>
      series?.hasInstagram
        ? topAgeBracketLabel(networks?.instagram?.age_buckets)
        : null,
    [series, networks],
  );

  const topYoutubeAge = useMemo(
    () =>
      series?.hasYoutube
        ? topAgeBracketLabel(networks?.youtube?.age_buckets)
        : null,
    [series, networks],
  );

  // Sem faixas etárias reais o painel inteiro sai da tela — nada de números
  // ilustrativos, que apareciam iguais em todo perfil e inventavam YouTube.
  if (!series) return null;

  return (
    <div className="bg-white rounded-xl px-4 py-5 border border-neutral-200 flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        {topInstagramAge && (
          <div className="flex flex-col gap-3">
            <p className="text-[17px] text-[#646464]">Maior público Instagram</p>
            <p className="text-2xl font-bold text-black">
              {topInstagramAge === "—" ? "—" : `${topInstagramAge} anos`}
            </p>
          </div>
        )}
        {topYoutubeAge && (
          <div className="flex flex-col gap-3 sm:text-right">
            <p className="text-[17px] text-[#646464]">Maior público YouTube</p>
            <p className="text-2xl font-bold text-black">
              {topYoutubeAge === "—" ? "—" : `${topYoutubeAge} anos`}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-6 text-sm text-[#202020]">
        {series.hasYoutube && (
          <div className="flex items-center gap-2">
            <span
              className="size-4 rounded"
              style={{ backgroundColor: NETWORK_COLOR.youtube }}
              aria-hidden
            />
            <span>Youtube</span>
          </div>
        )}
        {series.hasInstagram && (
          <div className="flex items-center gap-2">
            <span
              className="size-4 rounded"
              style={{ backgroundColor: NETWORK_COLOR.instagram }}
              aria-hidden
            />
            <span>Instagram</span>
          </div>
        )}
      </div>
      <div className="h-[320px] w-full min-h-0">
        <DemographicsBarChart series={series} />
      </div>
    </div>
  );
}
