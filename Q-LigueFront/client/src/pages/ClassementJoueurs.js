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
        const fetchScheduleAndSetLatestWeek = async () => {
            try {
                const scheduleResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/schedule`);
                const scheduleData = await scheduleResponse.json();
                
                const weekMap = new Map();
                scheduleData.forEach(item => {
                    if (!weekMap.has(item.weekid)) {
                        weekMap.set(item.weekid, {
                            id: item.weekid,
                            date: new Date(item.weekdate).toLocaleDateString('fr-CA', { timeZone: 'UTC' })
                        });
                    }
                });
                const uniqueWeeks = Array.from(weekMap.values()).sort((a, b) => a.id - b.id);
                setWeeks(uniqueWeeks);

                if (uniqueWeeks.length > 0) {
                    let latestWeekWithData = '';
                    for (let i = uniqueWeeks.length - 1; i >= 0; i--) {
                        const week = uniqueWeeks[i];
                        const rankingsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/rankings/${week.id}`);
                        const rankingsData = await rankingsResponse.json();
                        if (rankingsData.some(p => p.TotalGamesPlayed > 0)) {
                            latestWeekWithData = String(week.id);
                            break;
                        }
                    }
                    setSelectedWeek(latestWeekWithData || (uniqueWeeks.length > 0 ? String(uniqueWeeks[0].id) : ''));
                }
            } catch (error) {
                console.error("Erreur impossible de charger la semaine", error);
                setError("Erreur impossible de charger la semaine");
            }
        };
        fetchScheduleAndSetLatestWeek();
    }, []);


    useEffect(() => {
        if (!selectedWeek) {
            setLoading(false);
            return;
        }

        const fetchRankings = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/rankings/${selectedWeek}`);
                if (!response.ok) {
                    throw new Error(`Erreur du serveur`);
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
        <div className={`${styles.container} ${styles.tableRoot}`}>
            <div className={styles.header}>
                <h1>Classement des Joueurs</h1>
                <div className={styles.weekSelectorContainer}>
                    <label htmlFor="week-selector">Semaine: </label>
                    <select id="week-selector" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className={styles.weekSelector}>
                        {weeks.map(weekInfo => (
                            <option key={weekInfo.id} value={weekInfo.id}>
                                Semaine {weekInfo.id} ({weekInfo.date})
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
                enableStickyHeader
                muiTableContainerProps={{ className: styles.tableContainer }}
                muiTableHeadCellProps={{
                    sx: {
                        backgroundColor: 'var(--mrt-header-bg-color)',
                        color: 'var(--mrt-header-text-color)',
                        padding: 'var(--mrt-header-padding)',
                    },
                }}
                muiTableBodyRowProps={({ row, table }) => {
                    const { rows } = table.getRowModel();
                    const rowIndex = rows.findIndex(r => r.id === row.id);
                    return {
                        sx: { 
                            backgroundColor: rowIndex % 2 === 0
                                ? 'var(--mrt-row-bg-color-even)'
                                : 'var(--mrt-row-bg-color-odd)',
                        },
                    };
                }}
                muiTableBodyCellProps={{
                    sx: {
                        padding: 'var(--mrt-cell-padding)',
                    },
                }}
            />
        </div>
    );
};

export default ClassementJoueurs;