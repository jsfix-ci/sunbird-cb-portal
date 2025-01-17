import {
    AfterViewInit, Component,
    EventEmitter,
    HostListener,
    // HostListener,
    Input,
    OnChanges, OnDestroy, OnInit,
    Output,
    SimpleChanges, ViewEncapsulation,
} from '@angular/core'
import { NSPractice } from '../../../practice.model'
import { PracticeService } from '../../../practice.service'
import { jsPlumb, OnConnectionBindInfo } from 'jsplumb'
// tslint:disable-next-line
import _ from 'lodash'

@Component({
    selector: 'viewer-mtf-question',
    templateUrl: './mtf.component.html',
    styleUrls: ['./mtf.component.scss'],
    // tslint:disable-next-line
    encapsulation: ViewEncapsulation.None
})
export class MatchTheFollowingQuesComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
    @Input() question: NSPractice.IQuestion = {
        multiSelection: false,
        section: '',
        instructions: '',
        question: '',
        questionId: '',
        options: [
            {
                optionId: '',
                text: '',
                isCorrect: false,
            },
        ],
    }
    @Output() update = new EventEmitter<string | Object>()
    jsPlumbInstance: any
    edit = false
    matchHintDisplay: NSPractice.IOption[] = []
    localQuestion: string = this.question.question
    constructor(
        private practiceSvc: PracticeService,
    ) {

    }
    @HostListener('window:resize')
    onResize(_event: any) {
        this.repaintEveryThing()
    }
    ngOnInit() {
        // console.log(this.practiceSvc.questionAnswerHash.value)
        this.localQuestion = this.question.question
        this.question.options.map(option => (option.matchForView = option.match))
        const array = this.question.options.map(elem => elem.match)
        const arr = this.practiceSvc.shuffle(array)
        for (let i = 0; i < this.question.options.length; i += 1) {
            this.question.options[i].matchForView = arr[i]
        }
        const matchHintDisplayLocal = [...this.question.options]
        matchHintDisplayLocal.forEach(element => {
            if (element.hint) {
                this.matchHintDisplay.push(element)
            }
        })
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes) {

        }
    }
    ngAfterViewInit(): void {
        this.jsPlumbInstance = jsPlumb.getInstance({
            DragOptions: {
                cursor: 'pointer',
            },
            PaintStyle: {
                stroke: 'rgba(0,0,0,0.5)',
                strokeWidth: 3,
            },
        })
        const connectorType = ['Bezier', { curviness: 10 }]
        this.jsPlumbInstance.bind('connection', (_i: any, _c: any) => {
            // debugger
            // root cause
            // const allConnection = this.jsPlumbInstance.getAllConnections()
            // const finalConnection=[]
            // if (allConnection) {
            //     const allHast = this.practiceSvc.questionAnswerHash.getValue()
            //     const qHash = allHast[this.question.questionId]
            //     if (qHash && qHash[0]) {

            //         console.log(allHast, qHash[0])
            //         finalConnection.push()
            //     }
            // }
            if (!this.edit) {
                this.update.emit([...this.jsPlumbInstance.getAllConnections()])
            }
        })
        this.jsPlumbInstance.bind('connectionDetached', (i: OnConnectionBindInfo, _c: any) => {
            this.setBorderColor(i, '')
            this.resetColor()
            this.edit = false
        })
        this.jsPlumbInstance.bind(
            'connectionMoved',
            (i: { originalSourceId: string; newSourceId: string; originalTargetId: string }, _c: any) => {
                this.setBorderColorById(i.originalSourceId, '')
                this.setBorderColorById(i.newSourceId, '')
                this.setBorderColorById(i.originalTargetId, '')
                this.resetColor()
                this.edit = false
            })
        // get the list of ".smallWindow" elements.
        const questionSelector = `.question${this.question.questionId}`
        const answerSelector = `.answer${this.question.questionId}`
        const questions = this.jsPlumbInstance.getSelector(questionSelector)
        const answers = this.jsPlumbInstance.getSelector(answerSelector)
        this.jsPlumbInstance.batch(() => {
            this.jsPlumbInstance.makeSource((questions as unknown as string), {
                maxConnections: 1,
                connector: connectorType,
                overlay: 'Arrow',
                endpoint: [
                    'Dot',
                    {
                        radius: 3,
                    },
                ],
                anchor: 'Right',
            })
            this.jsPlumbInstance.makeTarget(answers as unknown as string, {
                maxConnections: 1,
                dropOptions: {
                    hoverClass: 'hover',
                },
                anchor: 'Left',
                endpoint: [
                    'Dot',
                    {
                        radius: 3,
                    },
                ],
            })
        })
        this.matchShowAnswer()
    }

    setBorderColorById(id: string, color: string | null) {
        const elementById: HTMLElement | null = document.getElementById(id)
        if (elementById && color) {
            elementById.style.borderColor = color
        }
    }

    setBorderColor(bindInfo: OnConnectionBindInfo, color: string) {
        const connnectionSourceId: HTMLElement | null = document.getElementById(bindInfo.sourceId)
        const connnectionTargetId: HTMLElement | null = document.getElementById(bindInfo.targetId)
        if (connnectionSourceId != null) {
            connnectionSourceId.style.borderColor = color
        }
        if (connnectionTargetId != null) {
            connnectionTargetId.style.borderColor = color
        }
    }
    resetMtf() {
        this.jsPlumbInstance.deleteEveryConnection()
        this.edit = false
    }

    resetColor() {
        const a = this.jsPlumbInstance.getAllConnections() as any[]
        a.forEach((element: { setPaintStyle: (arg0: { stroke: string }) => void }) => {
            element.setPaintStyle({
                stroke: 'rgba(0,0,0,0.5)',
            })
            // this.setBorderColor(element, '')
        })
    }
    repaintEveryThing() {
        this.jsPlumbInstance.repaintEverything()
    }
    changeColor() {
        const a = this.jsPlumbInstance.getAllConnections() as any[]
        if (a.length < this.question.options.length) {
            alert('Please select all answers')
            return
        }
        a.forEach(element => {
            const b = element.sourceId
            const options = this.question.options
            if (options) {
                const match = options[(b.slice(-1) as number) - 1].match
                if (match && match.trim() === element.target.innerHTML.trim()) {
                    element.setPaintStyle({
                        stroke: '#357a38',
                    })
                    this.setBorderColor(element, '#357a38')
                } else {
                    element.setPaintStyle({
                        stroke: '#f44336',
                    })
                    this.setBorderColor(element, '#f44336')
                }
            }
        })
    }
    matchShowAnswer() {
        this.jsPlumbInstance.deleteEveryConnection()
        for (let i = 1; i <= this.question.options.length; i += 1) {
            const questionSelector = `#c1${this.question.questionId}${i}`
            // for (let j = 1; j <= this.question.options.length; j += 1) {
            const selectedOptions = _.first(this.practiceSvc.questionAnswerHash.value[this.question.questionId] || []) || []
            // tslint:disable-next-line
            if (selectedOptions.length) {
                this.edit = true
            }
            for (let j = 1; j <= selectedOptions.length; j += 1) {
                const answerSelector = `#c2${this.question.questionId}${j}`
                const options = this.question.options[i - 1]
                if (options) {
                    const match = options.match
                    const selectors: HTMLElement[] = this.jsPlumbInstance.getSelector(answerSelector) as unknown as HTMLElement[]
                    if (match && match.trim() === selectors[0].innerText.trim()) {
                        this.jsPlumbInstance.connect({
                            endpoint: ['Dot', {
                                cssClass: 'amit icon-svg',
                                PaintStyle: {
                                    stroke: 'rgba(0,0,0,0.5)',
                                    strokeWidth: 3,
                                },
                            }],
                            source: this.jsPlumbInstance.getSelector(questionSelector) as unknown as Element,
                            target: this.jsPlumbInstance.getSelector(answerSelector) as unknown as Element,
                            anchors: ['Right', 'Left'],
                            ConnectionsDetachable: false,
                        })
                    }
                }
            }
        }
        // this.changeColor()
        setTimeout(() => {
            this.repaintEveryThing()
        },
            // tslint:disable-next-line:align
            100
        )

    }
    ngOnDestroy(): void {
        this.resetMtf()
    }
}
