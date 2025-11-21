import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface PlayerSparklineProps {
    data: { points: number }[];
    color?: string;
}

export default function PlayerSparkline({ data, color = "#22d3ee" }: PlayerSparklineProps) {
    if (!data || data.length < 2) return null;

    // Calculate min/max for domain to make the line fill the height
    const min = Math.min(...data.map(d => d.points));
    const max = Math.max(...data.map(d => d.points));
    const range = max - min;
    const padding = range > 0 ? range * 0.1 : 0.5; // Use fixed padding if all values are the same

    return (
        <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <YAxis
                        domain={[min - padding, max + padding]}
                        hide
                    />
                    <Line
                        type="monotone"
                        dataKey="points"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
