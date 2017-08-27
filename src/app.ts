// Imports
import * as express from 'express';
import * as path from 'path';
import * as yargs from 'yargs';
import * as cors from 'cors';
import * as expressWinston from 'express-winston';

// Imports middleware
import * as bodyParser from 'body-parser';
import * as exphbs from 'express-handlebars';

// Imports logger
import { logger } from './logger';

// Imports routes
import { HomeRouter } from './routes/home';

const argv = yargs.argv;
const app = express();

// Configures body parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({limit: '50mb'}));

app.use(cors());

app.use(expressWinston.logger({
    meta: true,
    msg: 'HTTP Request: {{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}} {{req.ip}}',
    winstonInstance: logger,
}));


// Configures static content
app.use('/static', express.static(path.join(__dirname, 'public')));

// Configures view engine
app.engine('handlebars', exphbs({
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'handlebars');

app.post('/epons-patient-report-service/', HomeRouter.index);

app.listen(argv.port || process.env.PORT || 3000, () => {
    console.log(`listening on port ${argv.port || process.env.PORT || 3000}`);
});
