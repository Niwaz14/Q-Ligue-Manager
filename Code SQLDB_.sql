--- Table pour équipe
CREATE TABLE Team(
    TeamID SERIAL PRIMARY KEY,
    TeamName VARCHAR(50) NOT NULL
);

--- Table pour les saisons avec leur placement temporel
CREATE TABLE Season(
    SeasonID SERIAL PRIMARY KEY,
    SeasonStart DATE,
    SeasonEnd DATE
);

--- Table pour les tiers de saison avec leur placement temporel
CREATE TABLE Splits(
    SplitID SERIAL PRIMARY KEY,
    SplitStart DATE,
    SplitEnd DATE,
    SeasonID INT NOT NULL,
    FOREIGN KEY(SeasonID) REFERENCES Season(SeasonID)
);

--- Table pour les semaine de jeu avec leur placement temporel
CREATE TABLE Week(
    WeekID SERIAL PRIMARY KEY,
    WeekDate DATE,
    SplitID INT NOT NULL,
    FOREIGN KEY(SplitID) REFERENCES Splits(SplitID)
);

--- Table pour les allées où les matchs sont joués
CREATE TABLE Lane(
    LaneID SERIAL PRIMARY KEY,
    LaneNumber VARCHAR(10) NOT NULL UNIQUE
);

--- Table pour les duels entre équipe
CREATE TABLE Matchup(
    MatchupID SERIAL PRIMARY KEY,
    WeekID INT NOT NULL,
    Team1_ID INT NOT NULL,
    Team2_ID INT NOT NULL,
    FOREIGN KEY(WeekID) REFERENCES Week(WeekID),
    FOREIGN KEY(Team1_ID) REFERENCES Team(TeamID),
    FOREIGN KEY(Team2_ID) REFERENCES Team(TeamID)
);

--- Table pour les joueurs appartenant à des équipes
CREATE TABLE Player(
    PlayerID SERIAL PRIMARY KEY,
    PlayerName VARCHAR(150) NOT NULL,
    PlayerCode VARCHAR(50) NOT NULL UNIQUE,
    CaptainAttribute BOOLEAN, 
    TeamID INT,
    FOREIGN KEY(TeamID) REFERENCES Team(TeamID)
);

--- Table pour les parties disputé par un joueur
CREATE TABLE Game(
    GameID SERIAL PRIMARY KEY,
    PlayerID INT NOT NULL,
    MatchupID INT NOT NULL,
    LaneID INT NOT NULL, 
    GameNumber INT NOT NULL,
    GameScore INT,
    GameApprovalStatus VARCHAR(50),
    FOREIGN KEY(PlayerID) REFERENCES Player(PlayerID),
    FOREIGN KEY(MatchupID) REFERENCES Matchup(MatchupID),
    FOREIGN KEY(LaneID) REFERENCES Lane(LaneID)
);