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
                const weekMap = new Map();
                data.forEach(item => {
                    if (!weekMap.has(item.weekid)) {
                        weekMap.set(item.weekid, {
                            id: item.weekid,
                            date: new Date(item.weekdate).toLocaleDateString('fr-CA')
                        });
                    }
                });
                const uniqueWeeks = Array.from(weekMap.values()).sort((a, b) => a.id - b.id);
                setWeeks(uniqueWeeks);

                if (uniqueWeeks.length > 0) {
                    const lastWeekId = uniqueWeeks[uniqueWeeks.length - 1].id;
                    const responseRankings = await fetch(`${process.env.REACT_APP_API_URL}/api/rankings/${lastWeekId}`);
                    const latestRankings = await responseRankings.json();
                    const latestWeekWithGames = latestRankings.some(p => p.TotalGamesPlayed > 0) ? lastWeekId : lastWeekId - 1;
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
        if (!selectedWeek) return; // Ne rien faire si aucune semaine n'est sélectionnée.

        const fetchRankings = async () => {
            setLoading(true);
            setError(null);
            try {
                // Appel à l'API pour obtenir le classement de la semaine choisie.
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/rankings/${selectedWeek}`);
                if (!response.ok) {
                    throw new Error(`Erreur du serveur`);
                }
                const data = await response.json();
                setRankings(data); // Mise à jour de l'état avec les nouvelles données.
            } catch (error) {
                console.error("Erreur de chargement du classement:", error);
                setError(error.message);
            } finally {
                setLoading(false); // S'assurer que l'indicateur de chargement est désactivé, même en cas d'erreur.
            }
        };
        fetchRankings();
    }, [selectedWeek]); // Le tableau de dépendances [selectedWeek] est crucial ici.

    // Définition des colonnes du tableau avec useMemo.
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

    // Affichage conditionnel en cas d'erreur.
    if (error) return <div className={styles.container}><p className={styles.error}>Erreur: {error}</p></div>;

    // Rendu principal du composant.
    return (
        <div className={`${styles.container} ${styles.tableRoot}`}>
            <div className={styles.header}>
                <h1>Classement des Joueurs</h1>
                <div className={styles.weekSelectorContainer}>
                    <label htmlFor="week-selector">Semaine: </label>
                    {/* Le sélecteur de semaine met à jour l'état `selectedWeek`, ce qui déclenche le re-chargement des données. */}
                    <select id="week-selector" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className={styles.weekSelector}>
                        {weeks.map(weekInfo => (
                            <option key={weekInfo.id} value={weekInfo.id}>
                                Semaine {weekInfo.id} ({weekInfo.date})
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            
          
            <MaterialReactTable // Utilisation de Material React Table pour afficher les données.
                columns={columns} 
                data={rankings} 
                state={{ isLoading: loading }} 
                initialState={{
                    density: 'compact', 
                    pagination: { pageSize: 120, pageIndex: 0 }, 
                }}
                enableStickyHeader // En-tête fixe pour une meilleure lisibilité lors du défilement.
                muiTableContainerProps={{ className: styles.tableContainer }}
                // Personnalisation du style via les props `mui`, une pratique courante avec Material-UI.
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
                        sx: { // Alternance de couleurs pour les lignes pour une meilleure lisibilité.
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
