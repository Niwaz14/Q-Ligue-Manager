import React, { useState, useEffect, useMemo } from 'react';
import { MaterialReactTable } from 'material-react-table';

const ClassementJoueurs = () => {
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [week, setWeek] = useState(4);

    useEffect(() => {
        const fetchRankings = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/rankings/${week}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Erreur Serveur: ${errorText}`);
                }
                const data = await response.json();
                setRankings(data);
            } catch (error) {
                console.error("Fetch Error:", error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchRankings();
    }, [week]);

    const formatNumber = (value, decimals = 0) => {
        const num = parseFloat(value);
        return !isNaN(num) ? num.toFixed(decimals) : 'N/A';
    };

   

    const columns = useMemo(
        () => [
            
            {
                id: 'ranking',
                header: 'Pos',
                Cell: ({ row }) => row.index + 1,
                size: 60,
            },
            { accessorKey: 'TeamName', header: 'Équipe' },
            { accessorKey: 'PlayerName', header: 'Joueur', size: 180 },
            { accessorKey: 'LastGame1', header: 'G1', size: 60, Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'LastGame2', header: 'G2', size: 60, Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'LastGame3', header: 'G3', size: 60, Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'Triple', header: 'Triple', Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'TripleWithHandicap', header: 'Triple Hdcp', Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'TotalSeasonScore', header: 'Total Quilles' },
            { accessorKey: 'TotalGamesPlayed', header: 'Parties' },
            { accessorKey: 'Handicap', header: 'Hdcp', Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'PriceMoney', header: 'Bourse', Cell: ({ cell }) => `$${formatNumber(cell.getValue(), 2)}` },
            { accessorKey: 'HighestSingle', header: 'Simple Max' },
            { accessorKey: 'HighestTriple', header: 'Triple Max' },
            { accessorKey: 'WeekPoints', header: 'Pts Sem' },
            { accessorKey: 'TotalPoints', header: 'Pts Saison' },
        ],
        [],
    );

    if (error) return <div style={{ padding: '1rem' }}>Erreur: {error}</div>;

    return (
        <div style={{ padding: '1rem' }}>
            <h1>Classement des Joueurs</h1>
            <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="week-selector">Semaine: </label>
                <select id="week-selector" value={week} onChange={e => setWeek(e.target.value)}>
                    {[...Array(36).keys()].map(i => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                </select>
            </div>
            
            <MaterialReactTable
                columns={columns}
                data={rankings}
                state={{ isLoading: loading }}
                initialState={{ density: 'compact' }}
            />
        </div>
    );
};

export default ClassementJoueurs;