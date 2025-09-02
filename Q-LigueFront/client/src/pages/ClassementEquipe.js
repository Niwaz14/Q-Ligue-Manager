import React, { useState, useEffect, useMemo } from 'react';
import { MaterialReactTable } from 'material-react-table';
import styles from './ClassementEquipe.module.css';

const ClassementEquipe = () => {
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
                        const rankingsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/team-rankings/${week.id}`);
                        const rankingsData = await rankingsResponse.json();
                        if (rankingsData.some(t => t.totalPoints > 0)) { 
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
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/team-rankings/${selectedWeek}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Erreur du serveur: ${errorText}`);
                }
                const data = await response.json();
                setRankings(data);
            } catch (error) {
                console.error("Erreur de chargement du classement des équipes:", error);
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
                header: 'Pos',
                Cell: ({ row }) => row.index + 1,
                size: 60,
            },
            { accessorKey: 'teamNumber', header: 'No Équipe' },
            { accessorKey: 'teamName', header: 'Nom Équipe' },
            { accessorKey: 'totalAverage', header: 'Moyenne Équipe' },
            { accessorKey: 'teamHandicap', header: 'HDCP Équipe' },
            { accessorKey: 'victories', header: 'Victoires' },
            { accessorKey: 'playerMatchupPoints', header: 'Pts Joueurs' },
            { accessorKey: 'bestSinglePoints', header: 'Pts Simple' },
            { accessorKey: 'petersonPoints', header: 'Pts Peterson' },
            { accessorKey: 'tripleBonusPoints', header: 'Pts Triple' },
            { accessorKey: 'previousWeekPoints', header: 'Pts Sem. Préc.' },
            { accessorKey: 'currentWeekPoints', header: 'Pts Semaine' },
            { accessorKey: 'totalPoints', header: 'Pts Total' },
            { accessorKey: 'prizeMoney', header: 'Bourse' },
        ],
        [],
    );

    if (error) return <div className={styles.container}><p>Erreur: {error}</p></div>;

    return (
        <div className={`${styles.container} ${styles.tableRoot}`}>
            <div className={styles.header}>
                <h1>Classement des Équipes</h1>
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

export default ClassementEquipe;