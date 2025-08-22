import React, { useState, useEffect, useMemo } from 'react';
import { MaterialReactTable } from 'material-react-table';
import styles from './ClassementJoueurs.module.css';

const ClassementJoueurs = () => {
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [weeks, setWeeks] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const data = await response.json();
                const uniqueDates = [...new Set(data.map(item => item.weekdate))].sort((a, b) => new Date(a) - new Date(b));
                
                const weekData = uniqueDates.map((date, i) => ({
                    number: i + 1,
                    date: new Date(date).toLocaleDateString('fr-CA'),
                }));
                setWeeks(weekData);
                if (weekData.length > 0) {
                    
                    const responseRankings = await fetch(`${process.env.REACT_APP_API_URL}/api/rankings/${weekData.length}`);
                    const latestRankings = await responseRankings.json();
                    const latestWeekWithGames = latestRankings.some(p => p.TotalGamesPlayed > 0) ? weekData.length : weekData.length - 1;
                    setSelectedWeek(String(latestWeekWithGames > 0 ? latestWeekWithGames : 1));
                }
            } catch (error) {
                console.error("Error fetching schedule:", error);
                setError("Could not load schedule data.");
            }
        };
        fetchSchedule();
    }, []);

    useEffect(() => {
        if (!selectedWeek) return;

        const fetchRankings = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/rankings/${selectedWeek}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Erreur du serveur: ${errorText}`);
                }
                const data = await response.json();
                setRankings(data);
            } catch (error) {
                console.error("Erreur de chargement du classement:", error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchRankings();
    }, [selectedWeek]);

    const columns = useMemo(
        () => [
            {
                id: 'ranking',
                header: 'Position',
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
            { accessorKey: 'Handicap', header: 'HDCP' },
            { accessorKey: 'TotalSeasonScore', header: 'Quilles Abattues' },
            { accessorKey: 'HighestSingle', header: 'Simple Max' },
            { accessorKey: 'HighestTriple', header: 'Série Max' },
            {
                accessorKey: 'LastGame1',
                header: 'P1',
                Cell: ({ cell }) => {
                    const { score, isAbsent } = cell.getValue();
                    if (score === null) return '';
                    return isAbsent ? `A-${score}` : score;
                },
            },
            {
                accessorKey: 'LastGame2',
                header: 'P2',
                Cell: ({ cell }) => {
                    const { score, isAbsent } = cell.getValue();
                    if (score === null) return '';
                    return isAbsent ? `A-${score}` : score;
                },
            },
            {
                accessorKey: 'LastGame3',
                header: 'P3',
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
                header: 'Série HDCP',
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
                    <select id="week-selector" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className={styles.weekSelector}>
                        {weeks.map(weekInfo => (
                            <option key={weekInfo.number} value={weekInfo.number}>
                                Semaine {weekInfo.number} ({weekInfo.date})
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            
            <MaterialReactTable
                columns={columns}
                data={rankings}
                state={{ isLoading: loading }}
                initialState={{
                    density: 'compact',
                    pagination: { pageSize: 120, pageIndex: 0 },
                }}
                muiTableHeadCellProps={{
                    sx: {
                        backgroundColor: '#3b658f',
                        color: '#ffffff',
                        padding: '8px',
                    },
                }}
                muiTableBodyRowProps={({ row, table }) => {
                    const { rows } = table.getRowModel();
                    const rowIndex = rows.findIndex(r => r.id === row.id);
                    return {
                        sx: {
                            backgroundColor: rowIndex % 2 === 0 ? '#f0f2f5' : '#ffffff',
                        },
                    };
                }}
                muiTableBodyCellProps={{
                    sx: {
                        padding: '2px 4px',
                    },
                }}
            />
        </div>
    );
};

export default ClassementJoueurs;
