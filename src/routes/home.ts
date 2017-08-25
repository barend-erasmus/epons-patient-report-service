// Imports
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as request from 'request-promise';
import * as Handlebars from 'handlebars';
import * as moment from 'moment';

export class HomeRouter {

    public static async index(req: express.Request, res: express.Response) {

        const startDate = req.body.startDate;
        const endDate = req.body.endDate;
        const patientId = req.body.patientId;
        const facilityId = req.body.facilityId;

        const vitalSignsChart = req.body.charts['Vital Signs']['line'];

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

        const patient = await request({
            headers: {
                apikey: '2c0d64c1-d002-45f2-9dc4-784c24e996',
            },
            json: true,
            uri: `http://api.sadfm.co.za/api/Patient/FindById?id=${patientId}`,
        });

        const facility = await request({
            headers: {
                apikey: '2c0d64c1-d002-45f2-9dc4-784c24e996',
            },
            json: true,
            uri: `http://api.sadfm.co.za/api/Facility/Find?id=${facilityId}`,
        });

        const visits = await request({
            headers: {
                apikey: '2c0d64c1-d002-45f2-9dc4-784c24e996',
            },
            json: true,
            uri: `http://api.sadfm.co.za/api/Visit/List?patientId=${patientId}&startDate=${moment(startDate).format('YYYY-MM-DD')}&endDate=${moment(endDate).format('YYYY-MM-DD')}`,
        });

        const episodeOfCares = await request({
            headers: {
                apikey: '2c0d64c1-d002-45f2-9dc4-784c24e996',
            },
            json: true,
            uri: `http://api.sadfm.co.za/api/EpisodeOfCare/List?patientId=${patientId}&startDate=${moment(startDate).format('YYYY-MM-DD')}&endDate=${moment(endDate).format('YYYY-MM-DD')}`,
        });

        episodeOfCares.forEach(element => {
            element.OnsetTimestamp = moment(element.OnsetTimestamp).format('YYYY-MM-DD');
            element.AdmissionTimestamp = moment(element.AdmissionTimestamp).format('YYYY-MM-DD HH:mm');
            element.DischargeTimestamp = element.DischargeTimestamp? moment(element.DischargeTimestamp).format('YYYY-MM-DD HH:mm') : null;
        });

        patient.MeasurementToolDetails.forEach(element => {
            element.AssignedTimestamp = moment(element.AssignedTimestamp).format('YYYY-MM-DD');
            element.DeassignedTimestamp = element.DeassignedTimestamp? moment(element.DeassignedTimestamp).format('YYYY-MM-DD') : null;
        });

        patient.TeamMembers.forEach(element => {
            element.AllocationTimestamp = moment(element.AllocationTimestamp).format('YYYY-MM-DD');
            element.DeallocationTimestamp = element.DeallocationTimestamp? moment(element.DeallocationTimestamp).format('YYYY-MM-DD') : null;
        });

        visits.forEach(element => {
            element.Timestamp = moment(element.Timestamp).format('YYYY-MM-DD HH:mm');
        });

        patient.DateOfBirth = patient.DateOfBirth? moment(patient.DateOfBirth).format('YYYY-MM-DD') : null;

        const diagnoses = episodeOfCares.filter((x) => x.Diagnoses).map((x) => x.Diagnoses).filter((x, index, self) => self.findIndex((y) => { return y.Id === x.Id }) === index);

        const referringDoctors = episodeOfCares.filter((x) => x.ReferringDoctor).map((x) => x.ReferringDoctor);
        const treatingDoctors = episodeOfCares.filter((x) => x.TreatingDoctor).map((x) => x.TreatingDoctor);

        const caseManagerNotes = visits.filter((visit) => {
            const note = visit.ProgressNotes ? visit.ProgressNotes.replace(/<(?:.|\n)*?>/gm, '') : null;
    
            return note? true: false;
          });

        const html = await HomeRouter.renderPage(path.join(__dirname, '../template.handlebars'), {
            caseManagerNotes,
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
        });

        const pdfResult = await request({
            body: {
                html,
            },
            json: true,
            encoding: null,
            method: 'POST',
            uri: `https://html-converter.openservices.co.za/api/convert/topdf`,
        });

        // res.setHeader('Content-disposition', 'attachment; filename=report.pdf');
        res.setHeader('Content-type', 'application/pdf');

        res.write(pdfResult,'binary');
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

