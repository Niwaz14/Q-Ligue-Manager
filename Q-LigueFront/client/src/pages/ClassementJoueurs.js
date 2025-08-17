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
                    throw new Error(`Network response was not ok: ${errorText}`);
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
        return typeof value === 'number' && !isNaN(value) ? value.toFixed(decimals) : 'N/A';
    };

    const columns = useMemo(
        () => [
            { accessorKey: 'PlayerName', header: 'Joueur', size: 200 },
            { accessorKey: 'TeamName', header: 'Équipe' },
            { accessorKey: 'Average', header: 'Moy', Cell: ({ cell }) => formatNumber(cell.getValue(), 2) },
            { accessorKey: 'LastGame1', header: 'G1', Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'LastGame2', header: 'G2', Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'LastGame3', header: 'G3', Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'Triple', header: 'Triple', Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'TripleWithHandicap', header: 'Triple Hdcp', Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'TotalSeasonScore', header: 'Quilles Saison' },
            { accessorKey: 'TotalGamesPlayed', header: 'Parties Jouées' },
            { accessorKey: 'Handicap', header: 'Hdcp', Cell: ({ cell }) => formatNumber(cell.getValue()) },
            { accessorKey: 'HighestSingle', header: 'Simple Max' },
            { accessorKey: 'WeekPoints', header: 'Pts Sem' },
            { accessorKey: 'TotalPoints', header: 'Pts Saison' },
        ],
        [],
    );

    if (error) return <div>Erreur: {error}</div>;

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