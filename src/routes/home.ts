// Imports
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as request from 'request-promise';
import * as Handlebars from 'handlebars';
import * as moment from 'moment';
import * as uuid from 'uuid';
import { footer } from './config';
import * as HTMLEntities from 'html-entities';

// Imports logger
import { logger } from './../logger';

export class HomeRouter {

    public static async index(req: express.Request, res: express.Response) {

        const profileId = uuid.v4();

        const startDate = req.body.startDate;
        const endDate = req.body.endDate;
        const patientId = req.body.patientId;
        const facilityId = req.body.facilityId;
        const showCaseManagerNotes = req.body.showCaseManagerNotes;
        const showDailyClinicalNotes = req.body.showDailyClinicalNotes;

        const vitalSignsChart = req.body.charts['Vital Signs'] ? req.body.charts['Vital Signs']['line'] : null;

        const charts = [];

        for (const chart in req.body.charts) {
            if (chart === 'Vital Signs') {
                continue;
            }

            charts.push({
                line: req.body.charts[chart]['line'],
                name: chart,
                radar: req.body.charts[chart]['radar'],
            });
        }

        logger.profile(`${profileId} - Patient`);

        const patient = await request({
            headers: {
                apikey: '2c0d64c1-d002-45f2-9dc4-784c24e996',
            },
            json: true,
            uri: `http://api.sadfm.co.za/api/Patient/FindById?id=${patientId}`,
        });

        logger.profile(`${profileId} - Patient`);

        logger.profile(`${profileId} - Facility`);

        const facility = await request({
            headers: {
                apikey: '2c0d64c1-d002-45f2-9dc4-784c24e996',
            },
            json: true,
            uri: `http://api.sadfm.co.za/api/Facility/Find?id=${facilityId}`,
        });

        logger.profile(`${profileId} - Facility`);

        logger.profile(`${profileId} - Visits`);

        const visits = await request({
            headers: {
                apikey: '2c0d64c1-d002-45f2-9dc4-784c24e996',
            },
            json: true,
            uri: `http://api.sadfm.co.za/api/Visit/List?patientId=${patientId}&startDate=${moment(startDate).format('YYYY-MM-DD')}&endDate=${moment(endDate).format('YYYY-MM-DD')}`,
        });

        logger.profile(`${profileId} - Visits`);

        logger.profile(`${profileId} - Episode of Cares`);

        const episodeOfCares = await request({
            headers: {
                apikey: '2c0d64c1-d002-45f2-9dc4-784c24e996',
            },
            json: true,
            uri: `http://api.sadfm.co.za/api/EpisodeOfCare/List?patientId=${patientId}&startDate=${moment(startDate).format('YYYY-MM-DD')}&endDate=${moment(endDate).format('YYYY-MM-DD')}`,
        });

        logger.profile(`${profileId} - Episode of Cares`);

        episodeOfCares.forEach(element => {
            element.OnsetTimestamp = element.OnsetTimestamp ? moment(element.OnsetTimestamp).format('YYYY-MM-DD') : null;
            element.AdmissionTimestamp = element.AdmissionTimestamp ? moment(element.AdmissionTimestamp).format('YYYY-MM-DD HH:mm') : null;
            element.DischargeTimestamp = element.DischargeTimestamp ? moment(element.DischargeTimestamp).format('YYYY-MM-DD HH:mm') : null;
        });

        patient.MeasurementToolDetails.forEach(element => {
            element.AssignedTimestamp = moment(element.AssignedTimestamp).format('YYYY-MM-DD');
            element.DeassignedTimestamp = element.DeassignedTimestamp ? moment(element.DeassignedTimestamp).format('YYYY-MM-DD') : null;
        });

        patient.TeamMembers.forEach(element => {
            element.AllocationTimestamp = moment(element.AllocationTimestamp).format('YYYY-MM-DD');
            element.DeallocationTimestamp = element.DeallocationTimestamp ? moment(element.DeallocationTimestamp).format('YYYY-MM-DD') : null;
        });

        visits.forEach(element => {
            element.Timestamp = moment(element.Timestamp).format('YYYY-MM-DD HH:mm');
        });

        patient.DateOfBirth = patient.DateOfBirth ? moment(patient.DateOfBirth).format('YYYY-MM-DD') : null;

        const diagnoses = episodeOfCares.filter((x) => x.Diagnoses).map((x) => x.Diagnoses).filter((x, index, self) => self.findIndex((y) => { return y.Id === x.Id }) === index);

        const referringDoctors = episodeOfCares.filter((x) => x.ReferringDoctor).map((x) => x.ReferringDoctor);
        const treatingDoctors = episodeOfCares.filter((x) => x.TreatingDoctor).map((x) => x.TreatingDoctor);

        const caseManagerNotes = visits.filter((visit) => {
            const note = visit.ProgressNotes ? visit.ProgressNotes.replace(/<(?:.|\n)*?>/gm, '') : null;

            return note ? true : false;
        });

        caseManagerNotes.forEach(element => {
            element.User.Fullname = new HTMLEntities.AllHtmlEntities().encode(element.User.Fullname);
        });

        const dailyClinicalNotes = visits.filter((visit) => {
            const note = visit.DailyNotes ? visit.DailyNotes.replace(/<(?:.|\n)*?>/gm, '') : null;

            return note ? true : false;
        });

        dailyClinicalNotes.forEach(element => {
            element.User.Fullname = new HTMLEntities.AllHtmlEntities().encode(element.User.Fullname);
        });

        logger.profile(`${profileId} - Render Page`);

        let html = await HomeRouter.renderPage(path.join(__dirname, '../template.handlebars'), {
            caseManagerNotes,
            dailyClinicalNotes,
            charts,
            diagnoses,
            endDate: moment(endDate).format('DD MMMM YYYY'),
            episodeOfCares,
            facility,
            patient,
            referringDoctors,
            startDate: moment(startDate).format('DD MMMM YYYY'),
            treatingDoctors,
            vitalSignsChart,
            showCaseManagerNotes,
            showDailyClinicalNotes,
        });

        logger.profile(`${profileId} - Render Page`);

        logger.profile(`${profileId} - To PDF`);

        const pdfResult = await request({
            body: {
                html,
                footer,
            },
            json: true,
            encoding: null,
            method: 'POST',
            uri: `http://html-converter.openservices.co.za/api/convert/topdf`,
        });

        logger.profile(`${profileId} - To PDF`);

        res.setHeader('Content-type', 'application/pdf');

        res.write(pdfResult, 'binary');
        res.end(null, 'binary');
    }

    private static renderPage(htmlFile: string, data: any): Promise<string> {
        return new Promise((resolve, reject) => {
            fs.readFile(htmlFile, 'utf8', (err: Error, html: string) => {
                if (err) {
                    reject(err);
                }

                const template = Handlebars.compile(html);

                const result = template(data);

                resolve(result);
            });
        })

    }
}

