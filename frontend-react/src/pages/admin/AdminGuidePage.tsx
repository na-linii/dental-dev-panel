import { useState, useEffect, useRef } from 'react'
import {
  ArrowUp, Eye, Bot,
  Info, Phone,
} from 'lucide-react'
import { STATUS_CONFIG, GUIDE_INCOMING_STATUSES, GUIDE_OUTGOING_STATUSES } from '../../config/adminStatuses'

/* ── Scroll-reveal hook ──────────────────────────────── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/* ── TOC items ───────────────────────────────────────── */
const toc = [
  { id: 'service-logic', label: 'Логика работы', icon: Bot },
  { id: 'statuses', label: 'Статусы', icon: Eye },
]

/* ── Main component ──────────────────────────────────── */
export function AdminGuidePage() {
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div>
      {/* ── Back to top ──────────────────────────────────── */}
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-6 right-6 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-accent text-white shadow-lg transition-all duration-300 hover:scale-110 ${showTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <ArrowUp className="w-4 h-4" />
      </button>

      {/* ══════════════════ HERO ══════════════════════════ */}
      <div className="relative overflow-hidden -mx-4 md:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 lg:-mt-8 px-4 md:px-6 lg:px-8 rounded-b-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-purple-500/[0.05] dark:from-accent/[0.05] dark:to-purple-500/[0.03]" />
        <div className="absolute top-20 -left-32 w-[400px] h-[400px] bg-accent/[0.06] rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 w-[300px] h-[300px] bg-purple-400/[0.05] rounded-full blur-[80px]" />

        <div className="max-w-4xl mx-auto pt-8 pb-10 md:pt-12 md:pb-14 relative">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-text-primary leading-tight">
              Руководство администратора
            </h1>
            <p className="text-base text-text-tertiary mt-3 max-w-xl leading-relaxed">
              Всё, что нужно знать для работы с панелью управления клиники.
            </p>
          </div>

          {/* ── TOC grid ─────────────────────────────────── */}
          <nav className="mt-8 grid grid-cols-2 gap-2.5">
            {toc.map((t) => (
              <a key={t.id} href={`#${t.id}`}
                className="flex items-center gap-2.5 bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200 dark:border-white/[0.06] rounded-xl px-3.5 py-3 hover:border-accent/30 hover:bg-white dark:hover:bg-white/[0.06] transition-all duration-200 group">
                <t.icon className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{t.label}</span>
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* ══════════════════ SECTIONS ═════════════════════ */}
      <div className="max-w-4xl mx-auto pb-20 space-y-20 mt-8">

        {/* ── 1. Service Logic ─────────────────────────── */}
        <Section id="service-logic" number={1} title="Логика работы сервиса">

          {/* ─── Входящая коммуникация ─── */}
          <Reveal>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Входящая коммуникация</p>
          </Reveal>

          <div className="space-y-4">

            {/* Сценарий 1 */}
            <Reveal delay={60}>
              <FlowCard>
                <FlowStep action="Пациент начал диалог. Агент отвечает" status="Разговор с агентом" statusColor="green" />
                <FlowStep action="Пациент просит перевести на администратора" status="Ожидает администратора" statusColor="red" />
                <FlowStep action="Администратор вступил в диалог" status="Разговор с администратором" statusColor="blue" />
                <FlowStep action="Администратор вручную поменял статус на «Чат завершён» или прошло N часов с момента последнего сообщения" status="Чат завершён" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарий 2 */}
            <Reveal delay={100}>
              <FlowCard>
                <FlowStep action="Пациент начал диалог. Агент отвечает" status="Разговор с агентом" statusColor="green" />
                <FlowStep action="Пациент получил информацию или перестал отвечать. Проходит N часов без новых сообщений" status="Чат завершён" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарий 3 */}
            <Reveal delay={140}>
              <FlowCard>
                <FlowStep action="Пациент начал диалог. Агент отвечает" status="Разговор с агентом" statusColor="green" />
                <div className="ml-5 pl-4 border-l-2 border-gray-200 dark:border-white/[0.08] mb-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Пациент просит сделать новую запись</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Агент создаёт новую запись</p>
                        <StatusTag label="Чат завершён" color="gray" />
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Агент не справляется и переводит на администратора</p>
                        <StatusTag label="Ожидает администратора" color="red" />
                      </div>
                    </div>
                  </div>
                </div>
              </FlowCard>
            </Reveal>

            {/* Сценарий 4 — Отмена */}
            <Reveal delay={180}>
              <FlowCard>
                <FlowStep action="Пациент начал диалог. Агент отвечает" status="Разговор с агентом" statusColor="green" />
                <FlowStep action="Пациент просит сделать отмену. Агент пишет, что сделал отмену, и переводит на администратора" status="Отмените в МИС" statusColor="orange" />
                <FlowStep action="Администратор отменяет запись в IDENT и нажимает «Готово» на странице «Действия»" status="Отменён" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарий 5 — Перенос */}
            <Reveal delay={220}>
              <FlowCard>
                <FlowStep action="Пациент начал диалог. Агент отвечает" status="Разговор с агентом" statusColor="green" />
                <FlowStep action="Пациент просит сделать перенос. Агент создаёт новую запись, пишет, что сделал перенос, и переводит на администратора" status="Перенесите в МИС" statusColor="orange" />
                <FlowStep action="Администратор отменяет старую запись в IDENT и нажимает «Готово» на странице «Действия»" status="Перенесён" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарий 6 — Чёрный список */}
            <Reveal delay={260}>
              <FlowCard>
                <FlowStep action="Приходит сообщение от номера в «чёрном списке». Агент не реагирует на сообщения" status="Ожидает администратора" statusColor="red" isLast />
              </FlowCard>
            </Reveal>

            {/* Блок без телефона */}
            <Reveal delay={300}>
              <div className="bg-blue-50 dark:bg-blue-500/[0.07] border border-blue-200 dark:border-blue-500/20 rounded-2xl p-5">
                <div className="flex items-start gap-3 mb-4">
                  <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Обработка клиентов без номера телефона</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      У некоторых контактов в Телеграм недоступно автоматическое получение номера телефона. Без номера телефона сервис не может сопоставить контакт пациента и его данные в МИС.
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2">
                      Это могут быть старые контакты, с которыми у клиники была коммуникация до запуска сервиса НаЛинии, или новые клиенты. При получении сообщения от старых клиентов агент пишет: «Добрый день. Мы обновляем информационную систему, пожалуйста, напишите свой номер телефона». У новых клиентов агент также запрашивает номер телефона первым сообщением.
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2">
                      Контакты без номера телефона подсвечиваются в списке и у них активна кнопка «Введите номер телефона» — для того чтобы администратор добавил вручную из МИС номер телефона, если он там существует.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-blue-200 dark:border-blue-500/20">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Сценарий: нет номера телефона</p>

                  <div className="space-y-3">
                    <FlowStep action="Приходит сообщение от контакта без номера телефона. Агент запрашивает номер телефона" status="Разговор с агентом" statusColor="green" />
                    <p className="text-sm text-gray-500 ml-5 pl-4 border-l-2 border-gray-200 dark:border-white/[0.08]">Если клиент не предоставил номер телефона:</p>
                    <div className="ml-5 pl-4 border-l-2 border-gray-200 dark:border-white/[0.08] space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Агент отвечает на вопросы по клинике</p>
                          <StatusTag label="Разговор с агентом" color="green" />
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">При запросе записи, переноса или отмены — агент повторно запрашивает номер телефона, и при отказе переводит на администратора</p>
                          <StatusTag label="Ожидает администратора" color="red" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* ─── Исходящая коммуникация ─── */}
          <Reveal delay={340}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-10 mb-4">Исходящая коммуникация (подтверждение записи)</p>
          </Reveal>

          <div className="space-y-4">

            {/* Сценарий 1 — Подтверждение */}
            <Reveal delay={380}>
              <FlowCard>
                <FlowStep action="Агент пишет напоминание о визите" status="Напоминание о визите" statusColor="green" />
                <FlowStep action="Пациент подтверждает визит" status="Подтвердите в МИС" statusColor="orange" />
                <FlowStep action="Администратор делает отметку в IDENT и нажимает «Готово» на странице «Действия»" status="Визит подтверждён" statusColor="gray" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарий 2 — Нет ответа */}
            <Reveal delay={420}>
              <FlowCard>
                <FlowStep action="Агент пишет напоминание о визите" status="Напоминание о визите" statusColor="green" />
                <FlowStep action="Пациент не отвечает. Агент отправляет второе напоминание. Пациент не отвечает N часов" status="Визит не подтверждён" statusColor="red" isLast />
              </FlowCard>
            </Reveal>

            {/* Сценарии-ссылки */}
            <Reveal delay={460}>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-start gap-3 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
                  <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Агент пишет напоминание о визите. Пациент просит сделать <b className="text-gray-700 dark:text-gray-300">отмену</b> → процесс отмены визита из «Входящей коммуникации»
                  </p>
                </div>
                <div className="flex-1 flex items-start gap-3 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
                  <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Агент пишет напоминание о визите. Пациент просит сделать <b className="text-gray-700 dark:text-gray-300">перенос</b> → процесс переноса визита из «Входящей коммуникации»
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ── 2. Statuses ──────────────────────────────────── */}
        <Section id="statuses" number={2} title="Статусы записей">

          {/* Входящая коммуникация */}
          <Reveal>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Входящая коммуникация</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-3">
            {GUIDE_INCOMING_STATUSES.map((key, i) => {
              const s = STATUS_CONFIG[key]
              return (
                <Reveal key={key} delay={i * 60}>
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${s.badge}`}>
                    <s.icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">{s.label}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>

          {/* Исходящая коммуникация */}
          <Reveal delay={500}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-7 mb-3">Исходящая коммуникация</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-3">
            {GUIDE_OUTGOING_STATUSES.map((key, i) => {
              const s = STATUS_CONFIG[key]
              return (
                <Reveal key={key} delay={580 + i * 60}>
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${s.badge}`}>
                    <s.icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">{s.label}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </Section>
      </div>

      {/* ══════════════════ FOOTER ════════════════════════ */}
      <div className="border-t border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-600">
          <p>&copy; 2026 НаЛинии. Все права защищены.</p>
          <p className="mt-1">Входит в группу компаний Star Smile</p>
        </div>
      </div>
    </div>
  )
}

/* ── Section wrapper ─────────────────────────────────── */
function Section({ id, number, title, children }: {
  id: string; number: number; title: string; children: React.ReactNode
}) {
  const { ref, visible } = useReveal()
  return (
    <section id={id} className="scroll-mt-8">
      <div ref={ref} className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="flex items-center gap-3 mb-6">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent text-sm font-bold">{number}</span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  )
}

/* ── Flow card ───────────────────────────────────────── */
function FlowCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4 shadow-sm dark:shadow-none">
      {children}
    </div>
  )
}

/* ── Flow step ───────────────────────────────────────── */
type StatusColor = 'green' | 'orange' | 'red' | 'blue' | 'gray'

function FlowStep({ action, status, statusColor, isLast = false }: {
  action: string; status: string; statusColor: StatusColor; isLast?: boolean
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1.5">
        <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
        {!isLast && <div className="w-px bg-gray-200 dark:bg-white/[0.08] flex-1 my-1" style={{ minHeight: '28px' }} />}
      </div>
      <div className={`${isLast ? '' : 'pb-3'}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{action}</p>
        <div className="mt-1.5">
          <StatusTag label={status} color={statusColor} />
        </div>
      </div>
    </div>
  )
}

/* ── Status tag ──────────────────────────────────────── */
function StatusTag({ label, color }: { label: string; color: StatusColor }) {
  const cls: Record<StatusColor, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25',
    orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/25',
    red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25',
    gray: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-500/25',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${cls[color]}`}>
      <span className="text-[10px] opacity-60">Статус:</span>{label}
    </span>
  )
}
