import React, { useState, useEffect, useMemo } from 'react';
import { MaterialReactTable } from 'material-react-table';
import styles from './ClassementJoueurs.module.css';

const ClassementJoueurs = () => {
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [week, setWeek] = useState(1); 

    useEffect(() => {
        const fetchRankings = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/rankings/${week}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Erreur: ${errorText}`);
                }
                const data = await response.json();
                setRankings(data);
            } catch (error) {
                console.error("Erreur:", error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchRankings();
    }, [week]);

    const columns = useMemo(
        () => [
            {
                id: 'ranking',
                header: 'Pos',
                Cell: ({ row }) => row.index + 1,
                size: 60,
            },
            { accessorKey: 'PlayerName', header: 'Joueur', size: 180 },
            { accessorKey: 'TeamName', header: 'Équipe' },
            {
                accessorKey: 'Average',
                header: 'Moyenne',
                Cell: ({ cell }) => cell.getValue()?.toFixed(2),
                size: 100,
            },
            { accessorKey: 'TotalGamesPlayed', header: 'P.J.' },
            { accessorKey: 'Handicap', header: 'HCP' },
            { accessorKey: 'HighestSingle', header: 'Simple Max' },
            { accessorKey: 'HighestTriple', header: 'Série Max' },
            {
                accessorKey: 'LastGame1',
                header: 'P 1',
                Cell: ({ cell }) => {
                    const { score, isAbsent } = cell.getValue();
                    if (score === null) return '';
                    return isAbsent ? `A-${score}` : score;
                },
            },
            {
                accessorKey: 'LastGame2',
                header: 'P 2',
                Cell: ({ cell }) => {
                    const { score, isAbsent } = cell.getValue();
                    if (score === null) return '';
                    return isAbsent ? `A-${score}` : score;
                },
            },
            {
                accessorKey: 'LastGame3',
                header: 'P 3',
                Cell: ({ cell }) => {
                    const { score, isAbsent } = cell.getValue();
                    if (score === null) return '';
                    return isAbsent ? `A-${score}` : score;
                },
            },
            {
                accessorKey: 'Triple',
                header: 'Série Sem.',
                Cell: ({ row }) => {
                    const games = [row.original.LastGame1, row.original.LastGame2, row.original.LastGame3];
                    const playedGames = games.filter(g => g.score !== null && !g.isAbsent);
                    if (playedGames.length === 0) return '';
                    return playedGames.reduce((sum, game) => sum + game.score, 0);
                },
            },
            {
                accessorKey: 'TripleWithHandicap',
                header: 'Série HCP',
                Cell: ({ row }) => {
                    const games = [row.original.LastGame1, row.original.LastGame2, row.original.LastGame3];
                    const playedGames = games.filter(g => g.score !== null && !g.isAbsent);
                    if (playedGames.length === 0) return '';
                    const tripleScore = playedGames.reduce((sum, game) => sum + game.score, 0);
                    const handicap = row.original.Handicap || 0;
                    return tripleScore + (handicap * playedGames.length);
                },
            },
            { accessorKey: 'WeekPoints', header: 'Pts Sem.' },
            { accessorKey: 'TotalPoints', header: 'Pts Saison' },
        ],
        [],
    );

    if (error) return <div className={styles.container}><p className={styles.error}>Erreur: {error}</p></div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Classement des Joueurs</h1>
                <div className={styles.weekSelectorContainer}>
                    <label htmlFor="week-selector">Semaine: </label>
                    <select id="week-selector" value={week} onChange={e => setWeek(e.target.value)} className={styles.weekSelector}>
                        {[...Array(36).keys()].map(i => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                    </select>
                </div>
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