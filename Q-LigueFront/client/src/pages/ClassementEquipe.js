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
                    
                    setSelectedWeek(String(weekData.length));
                }
            } catch (error) {
                console.error("Error à la récupération de l'horaire:", error);
                setError("Impossible de charger l'horaire.");
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
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Classement des Équipes</h1>
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
                enableStickyHeader
                muiTableContainerProps={{ sx: { overflowX: 'auto' } }}
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

export default ClassementEquipe;