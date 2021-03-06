import { Request, Response, NextFunction } from "express";
import { sql } from "../sql";
import express from "express";
import { dbConfig, userDBConfig } from "../dbconfig";
import { verifyToken } from "../authentification";
import jwt from "jsonwebtoken";
import R from "ramda";
import shortHash from "shorthash";

const blogMgmt = express.Router();

blogMgmt.post("/", verifyToken, (req: Request, res: Response) => {

  const token = req.body.token;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  sql.connect(userDBConfig, async (con: any) => {
    const fetchQuery = `select * from usersurltbl where UserID = '${decoded.ID}'`;

    const searchRes = await con.query(fetchQuery);

    res.json(searchRes);
  })();
});

blogMgmt.post("/Add", verifyToken, async (req: Request, res: Response, next: NextFunction) => {

  const token = req.body.token;
  const userID: string = jwt.verify(token, process.env.JWT_SECRET).ID;

  const { blogURL, blogTitle } = req.body;

  const urlID = shortHash.unique(blogURL);

  let duplicateURL;

  await sql.connect(userDBConfig, async (con: any) => {
    const idDupCheck = `select * from usersurltbl where URLID = '${urlID}'`;
    duplicateURL = await con.query(idDupCheck);

    if (!R.isEmpty(duplicateURL)) return;

    const insertNewService = 
      `insert into usersurltbl (
          URLID,
          URLTitle,
          URL,
          UserID
          ) VALUES(
          '${urlID}',
          '${blogTitle}',
          '${blogURL}',
          '${userID}'
          )`;
    await con.query(insertNewService);

    const createDB = `create database ${urlID} charset 'utf8mb4' collate utf8mb4_unicode_ci`;
    await con.query(createDB);
  })();

  if (!R.isEmpty(duplicateURL)) {
    res.json({ VALID: false });
    return;
  }

  sql.connect(dbConfig(urlID, 4), async (con: any) => {
    const createTbl = `
        create table visitorcounter (
          \`I\`       int(11)     not null auto_increment,
          \`PageID\`  mediumtext  not null,
          \`REGDATE\` datetime    not null,
          \`REGIP\`   varchar(30) null,
          \`REFERER\` text        null,
          primary   key(\`I\`)
      )`;
    await con.query(createTbl);

    // 특정 서비스의 특정 PageID 테이블이 갖는 게시글 Title 정보를 갖고 있다.
    // 즉, 어떤 게시글의 제목 정보를 담고 있는 테이블이다.
    const createPageTitlePairTable = `
        create table pagetitlepairs(
          \`PageID\`  mediumtext  not null,
          \`Title\`   mediumtext  not null
        )`;

    await con.query(createPageTitlePairTable);
  })();

  res.json({ VALID: true });

});

blogMgmt.post("/Delete", verifyToken, (req: Request, res: Response) => {

  const token = req.body.token;

  const userID: string = jwt.verify(token, process.env.JWT_SECRET).ID;

  const { blogID } = req.body;

  sql.connect(userDBConfig, async (con: any) => {
    const deleteRecord = `delete from usersurltbl where URLID = '${blogID}' and UserID = '${userID}'`;
    await con.query(deleteRecord);

    const dropDatabase = `drop database ${blogID}`;
    await con.query(dropDatabase);
  })();

  res.json({ VALID: true });
});


export default blogMgmt;
